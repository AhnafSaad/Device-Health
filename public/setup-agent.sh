#!/bin/bash
set -uo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run this with sudo: sudo ./setup-healthstream-agent.sh"
  exit 1
fi

echo "===================================================================="
echo "   HealthStream Universal Monitoring Agent Setup (All Brands)      "
echo "   Supports: Dell, HP/HPE, Supermicro, Cisco, Lenovo, Proxmox/Debian"
echo "===================================================================="
echo

COMM=""
while [[ -z "$COMM" ]]; do
  read -rp "Enter the SNMP community string to use for this server: " COMM </dev/tty
  if [[ -z "$COMM" ]]; then
    echo "Community string cannot be empty. Please enter a valid community string."
  fi
done
echo "Configuring with SNMP Community: $COMM"
echo

LOG="/var/log/healthstream-agent-setup.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== Starting setup — $(date) ==="

# 1. Install base packages
echo "[1/8] Installing base packages (snmpd, smartmontools, ipmitool, jq, nvme-cli)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq snmpd smartmontools nvme-cli ipmitool dmidecode mdadm jq pciutils >/dev/null 2>&1

# 2. Sudoers permissions for Debian-snmp user
echo "[2/8] Setting up sudoers for Debian-snmp..."
cat << 'EOF_SUDO' > /etc/sudoers.d/healthstream-agent
Debian-snmp ALL=(root) NOPASSWD: /usr/sbin/smartctl
Debian-snmp ALL=(root) NOPASSWD: /usr/sbin/nvme
Debian-snmp ALL=(root) NOPASSWD: /usr/bin/ipmitool
Debian-snmp ALL=(root) NOPASSWD: /usr/sbin/dmidecode
Debian-snmp ALL=(root) NOPASSWD: /usr/bin/cat
EOF_SUDO
chmod 440 /etc/sudoers.d/healthstream-agent
visudo -cf /etc/sudoers.d/healthstream-agent >/dev/null 2>&1 || { echo "Sudoers syntax error"; exit 1; }

# 3. Kernel IPMI drivers
echo "[3/8] Ensuring IPMI kernel drivers are loaded..."
modprobe ipmi_si 2>/dev/null || true
modprobe ipmi_devintf 2>/dev/null || true
modprobe ipmi_ssif 2>/dev/null || true
cat << 'EOF_MOD' > /etc/modules-load.d/ipmi.conf
ipmi_msghandler
ipmi_devintf
ipmi_si
ipmi_ssif
EOF_MOD

# 4. Write Extend Scripts
echo "[4/8] Installing monitoring telemetry extend scripts..."

# --- 4a. Disk I/O ---
cat << 'EOF_IO' > /usr/local/bin/disk-io-all.sh
#!/bin/bash
F=/proc/diskstats
awk '
function esc(s){ gsub(/\\/,"\\\\",s); gsub(/"/,"\\\"",s); return s }
{
  dev=$3
  if (dev ~ /^(loop|sr|dm-)/) next
  if (dev ~ /^nvme[0-9]+n[0-9]+p[0-9]+$/) next
  if (dev ~ /^(sd|vd|hd)[a-z]+[0-9]+$/) next
  if (dev ~ /^nvme[0-9]+n[0-9]+$/ || dev ~ /^(sd|vd|hd)[a-z]+$/) {
    readb = $6 * 512
    writeb = $10 * 512
    n++
    out = out (n>1?",":"") "{\"device\":\"" esc(dev) "\",\"read_bytes\":" readb ",\"written_bytes\":" writeb "}"
  }
}
END{ print "[" out "]" }
' "$F"
EOF_IO
chmod +x /usr/local/bin/disk-io-all.sh

# --- 4b. Disk Lifecycle (Universal: NVMe, SATA SSD, SAS SSD, HDD & Hardware RAID) ---
cat << 'EOF_LIFE' > /usr/local/bin/disk-lifecycle-all.sh
#!/bin/bash
out="["
first=1

inspect_target() {
  local dev_name="$1"
  local target_args="$2"
  local rot_hint="$3"

  local json
  json=$(sudo /usr/sbin/smartctl -j -a $target_args 2>/dev/null)
  [ -z "$json" ] && return 1

  local passed
  passed=$(echo "$json" | jq -r '.smart_status.passed // empty' 2>/dev/null)
  local power_on
  power_on=$(echo "$json" | jq -r '.power_on_time.hours // empty' 2>/dev/null)

  # Check NVMe wear
  local nvme_used
  nvme_used=$(echo "$json" | jq -r '.nvme_smart_health_information_log.percentage_used // empty' 2>/dev/null)

  # Check SATA SSD wear
  local wear_val=""
  local attr_table
  attr_table=$(echo "$json" | jq -r '.ata_smart_attributes.table // empty' 2>/dev/null)
  if [ -n "$attr_table" ]; then
    wear_val=$(echo "$json" | jq -r '.ata_smart_attributes.table[] | select(.id==233 or .id==231 or .id==177 or .id==173) | .value' 2>/dev/null | head -1)
  fi

  # Check sector metrics
  local realloc pending uncorrect
  realloc=$(echo "$json" | jq -r '.ata_smart_attributes.table[] | select(.id==5) | .raw.value' 2>/dev/null | head -1)
  pending=$(echo "$json" | jq -r '.ata_smart_attributes.table[] | select(.id==197) | .raw.value' 2>/dev/null | head -1)
  uncorrect=$(echo "$json" | jq -r '.ata_smart_attributes.table[] | select(.id==198) | .raw.value' 2>/dev/null | head -1)

  # If RAID Virtual Disk has NO SMART data at all, skip so physical disks can be probed
  if [ -z "$passed" ] && [ -z "$power_on" ] && [ -z "$nvme_used" ] && [ -z "$wear_val" ] && [ -z "$realloc" ]; then
    return 1
  fi

  [ -z "$passed" ] && passed="null"
  [ -z "$power_on" ] && power_on="null"
  [ -z "$realloc" ] && realloc="null"
  [ -z "$pending" ] && pending="null"
  [ -z "$uncorrect" ] && uncorrect="null"

  # If NVMe
  if [ -n "$nvme_used" ]; then
    local dur duw
    dur=$(echo "$json" | jq -r '.nvme_smart_health_information_log.data_units_read // empty' 2>/dev/null)
    duw=$(echo "$json" | jq -r '.nvme_smart_health_information_log.data_units_written // empty' 2>/dev/null)
    [ -n "$dur" ] && dur=$(awk "BEGIN {printf \"%.0f\", $dur * 512000}") || dur="null"
    [ -n "$duw" ] && duw=$(awk "BEGIN {printf \"%.0f\", $duw * 512000}") || duw="null"

    [[ $first -eq 0 ]] && out="$out,"
    first=0
    out="$out{\"device\":\"$dev_name\",\"type\":\"nvme\",\"percentage_used\":$nvme_used,\"power_on_hours\":$power_on,\"lifetime_bytes_read\":$dur,\"lifetime_bytes_written\":$duw,\"passed\":$passed}"
    return 0
  fi

  # Check if SSD
  local is_ssd=0
  local rot
  rot=$(echo "$json" | jq -r '.rotation_rate // empty' 2>/dev/null)
  if [ "$rot" = "0" ] || [ "$rot_hint" = "0" ] || [ -n "$wear_val" ]; then
    is_ssd=1
  fi

  local lba_w="" lba_r=""
  if [ -n "$attr_table" ]; then
    lba_w=$(echo "$json" | jq -r '.ata_smart_attributes.table[] | select(.id==241) | .raw.value' 2>/dev/null | head -1)
    lba_r=$(echo "$json" | jq -r '.ata_smart_attributes.table[] | select(.id==242) | .raw.value' 2>/dev/null | head -1)
  fi
  local tbw="null" tbr="null"
  [ -n "$lba_w" ] && tbw=$(awk "BEGIN {printf \"%.0f\", $lba_w * 512}")
  [ -n "$lba_r" ] && tbr=$(awk "BEGIN {printf \"%.0f\", $lba_r * 512}")

  if [ "$is_ssd" -eq 1 ]; then
    local pct_used="null"
    if [ -n "$wear_val" ] && [ "$wear_val" -ge 0 ] && [ "$wear_val" -le 100 ]; then
      pct_used=$(( 100 - wear_val ))
    fi
    [[ $first -eq 0 ]] && out="$out,"
    first=0
    out="$out{\"device\":\"$dev_name\",\"type\":\"ssd_sata\",\"percentage_used\":$pct_used,\"power_on_hours\":$power_on,\"lifetime_bytes_read\":$tbr,\"lifetime_bytes_written\":$tbw,\"passed\":$passed,\"reallocated\":$realloc,\"pending\":$pending,\"uncorrectable\":$uncorrect}"
  else
    [[ $first -eq 0 ]] && out="$out,"
    first=0
    out="$out{\"device\":\"$dev_name\",\"type\":\"hdd_sata\",\"passed\":$passed,\"reallocated\":$realloc,\"pending\":$pending,\"uncorrectable\":$uncorrect,\"power_on_hours\":$power_on}"
  fi
  return 0
}

# 1. Probing MegaRAID / Dell PERC physical disk slots (0 to 7)
for slot in {0..7}; do
  inspect_target "slot$slot" "-d megaraid,$slot /dev/sda" "1"
done

# 2. Probing Direct Block Devices
for dev in $(lsblk -dno NAME,TYPE 2>/dev/null | awk '$2=="disk"{print $1}'); do
  [[ "$dev" == loop* || "$dev" == sr* ]] && continue
  rot=$(cat "/sys/block/$dev/queue/rotational" 2>/dev/null || echo 1)
  inspect_target "$dev" "/dev/$dev" "$rot"
done

out="$out]"
echo "$out"
EOF_LIFE
chmod +x /usr/local/bin/disk-lifecycle-all.sh

# --- 4c. RAM Health & Details ---
cat << 'EOF_RAM' > /usr/local/bin/ram-health.sh
#!/bin/bash
ce=$(cat /sys/devices/system/edac/mc/mc*/ce_count 2>/dev/null | awk '{s+=$1} END{print s+0}')
ue=$(cat /sys/devices/system/edac/mc/mc*/ue_count 2>/dev/null | awk '{s+=$1} END{print s+0}')
echo "$ce $ue"
EOF_RAM
chmod +x /usr/local/bin/ram-health.sh

cat << 'EOF_MCD' > /usr/local/bin/ram-mc-detail.sh
#!/bin/bash
for d in /sys/devices/system/edac/mc/mc*/; do
  [ -d "$d" ] || continue
  n=$(basename "$d")
  ce=$(cat "$d/ce_count" 2>/dev/null || echo 0)
  ue=$(cat "$d/ue_count" 2>/dev/null || echo 0)
  echo -n "$n:$ce:$ue "
done
echo
EOF_MCD
chmod +x /usr/local/bin/ram-mc-detail.sh

# --- 4d. IPMI Health (Universal: Dell iDRAC + HP iLO + Supermicro) ---
cat << 'EOF_IPMI' > /usr/local/bin/ipmi-health.sh
#!/bin/bash
SRC=$(sudo /usr/bin/ipmitool sensor 2>/dev/null)
if [ -z "$SRC" ]; then
  SRC=$(sudo /usr/bin/ipmitool sdr elist full 2>/dev/null)
fi
if [ -z "$SRC" ]; then
  echo '{"temp_max":null,"temp_inlet":null,"fans":[],"psu":[],"ipmi_error":"no_response"}'
  exit 0
fi

# Extract Dell total power consumption if present (e.g., Pwr Consumption: 126 Watts)
TOTAL_WATTS=$(echo "$SRC" | awk -F'|' '
tolower($1) ~ /(pwr consumption|power consumption|system board pwr)/ && $3 ~ /Watts/ {
  gsub(/[^0-9.]/,"",$2); print int($2); exit
}')
if [ -z "$TOTAL_WATTS" ]; then
  TOTAL_WATTS=$(sudo /usr/bin/ipmitool dcmi power reading 2>/dev/null | awk -F':' '/Instantaneous power reading/{gsub(/[^0-9]/,"",$2); print int($2); exit}')
fi

echo "$SRC" | awk -v total_pwr="$TOTAL_WATTS" -F'|' '
function trim(s){gsub(/^[ \t]+|[ \t]+$/,"",s); return s}
function mapst(s){ s=tolower(s); if(s=="ok"||s=="0x0100"||s=="0x01") return "ok"; if(s=="nc") return "warning"; if(s=="cr"||s=="nr") return "critical"; return "ok" }
function esc(s){ gsub(/\\/,"\\\\",s); gsub(/"/,"\\\"",s); return s }
BEGIN{ nf=0; np=0; tmax=""; tin="" }
{
  name=trim($1); val=trim($2); unit=trim($3); st=trim($4); l=tolower(name)
  if (name=="") next

  # Temperatures
  if ((unit=="degrees C" || l ~ /temp/) && val ~ /^[0-9.]+$/) {
    v=val+0
    if (tmax=="" || v>tmax) tmax=v
    if (tin=="" && l ~ /inlet/) tin=v
    next
  }

  # Fans
  if (l ~ /^fan/ && l !~ /dutycycle|redundancy|status|^fans$/ && (unit=="RPM"||unit=="percent") ) {
    if (val ~ /^[0-9.]+$/) { nf++; fn[nf]=name; fv[nf]=val+0; fu[nf]=unit; fs[nf]=mapst(st) }
    next
  }

  # HP iLO Style PSU with individual Watts
  if (l ~ /^(power supply|ps|psu)[ _-]?[0-9]+$/ && tolower(unit)=="watts") {
    num=l; gsub(/[^0-9]/,"",num); num=num+0
    if(!seen[num]) { seen[num]=1; pids[++np]=num }
    pn[num]="PSU " num; ps[num]=mapst(st); pw[num]=(val ~ /^[0-9.]+$/)?val+0:""
    next
  }

  # Dell / IPMI Amps Current sensors (e.g. Current 1, Current 2)
  if (l ~ /^current[ _-]?[0-9]+$/ && tolower(unit)=="amps") {
    num=l; gsub(/[^0-9]/,"",num); num=num+0
    if(!seen[num]) { seen[num]=1; pids[++np]=num }
    pn[num]="PSU " num; ps[num]=mapst(st); if(!pw[num]) pw[num]=""
    next
  }

  # Dell iDRAC Style PSU (e.g. PS1 Status, PS1 PG Fail, PS2 PG Fail)
  if (l ~ /^ps[0-9]+ (status|pg fail|pg)$/) {
    num=l; gsub(/[^0-9]/,"",num); num=num+0
    if(!seen[num]) { seen[num]=1; pids[++np]=num }
    pn[num]="PSU " num
    if (!ps[num] || ps[num]=="ok") ps[num]=(st ~ /critical|fail|0x02|0x04/) ? "critical" : "ok"
    if(!pw[num]) pw[num]=""
    next
  }
}
END{
  for(i=1;i<=np;i++) for(j=i+1;j<=np;j++) if(pids[i]>pids[j]){ tmp=pids[i]; pids[i]=pids[j]; pids[j]=tmp }

  out="{\"temp_max\":" (tmax==""?"null":tmax) ",\"temp_inlet\":" (tin==""?"null":tin) ",\"fans\":["
  for(i=1;i<=nf;i++){
    if(i>1) out=out ","
    out=out "{\"name\":\"" esc(fn[i]) "\",\"status\":\"" fs[i] "\",\"value\":" (fv[i]==""?"null":fv[i]) ",\"unit\":\"" fu[i] "\"}"
  }
  out=out "],\"psu\":["
  for(i=1;i<=np;i++){
    id=pids[i]
    if(i>1) out=out ","
    wval = pw[id]
    if (wval=="" && total_pwr > 0 && np > 0) wval = int(total_pwr / np)
    out=out "{\"name\":\"" pn[id] "\",\"status\":\"" ps[id] "\",\"watts\":" (wval==""?"null":wval) "}"
  }
  out=out "]}"
  print out
}'
EOF_IPMI
chmod +x /usr/local/bin/ipmi-health.sh

# --- 4e. Hardware Identity ---
cat << 'EOF_HW' > /usr/local/bin/hw-identity.sh
#!/bin/bash
mfr=$(sudo /usr/sbin/dmidecode -s system-manufacturer 2>/dev/null | head -1)
model=$(sudo /usr/sbin/dmidecode -s system-product-name 2>/dev/null | head -1)
serial=$(sudo /usr/sbin/dmidecode -s system-serial-number 2>/dev/null | head -1)
printf '%s|%s|%s\n' "$mfr" "$model" "$serial"
EOF_HW
chmod +x /usr/local/bin/hw-identity.sh

# 5. snmpd.conf
echo "[5/8] Configuring /etc/snmp/snmpd.conf..."
CONF=/etc/snmp/snmpd.conf
[ -f "$CONF" ] && cp "$CONF" "${CONF}.bak.$(date +%s)"

cat << EOF_SNMP > "$CONF"
agentaddress udp:161
view all included .1
rocommunity ${COMM} default -V all
sysLocation Datacenter
sysContact admin
# BEGIN HEALTHSTREAM-AGENT
extend disk-io-all /usr/local/bin/disk-io-all.sh
extend disk-lifecycle-all /usr/local/bin/disk-lifecycle-all.sh
extend ram-health /usr/local/bin/ram-health.sh
extend ram-mc-detail /usr/local/bin/ram-mc-detail.sh
extend ipmi-health /usr/local/bin/ipmi-health.sh
extend hw-identity /usr/local/bin/hw-identity.sh
# END HEALTHSTREAM-AGENT
EOF_SNMP

# 6. Restart snmpd
echo "[6/8] Restarting snmpd service..."
systemctl restart snmpd
systemctl enable snmpd >/dev/null 2>&1
sleep 2

# 7. Verification tests
echo "[7/8] Testing script outputs locally..."
echo "--- hw-identity ---"
sudo -u Debian-snmp /usr/local/bin/hw-identity.sh
echo "--- disk-lifecycle-all ---"
sudo -u Debian-snmp /usr/local/bin/disk-lifecycle-all.sh
echo "--- ipmi-health ---"
sudo -u Debian-snmp /usr/local/bin/ipmi-health.sh

echo
echo "===================================================================="
echo " [8/8] Agent setup completed successfully!                         "
echo " Go to your HealthStream dashboard and click 'Poll Device Live'.    "
echo "===================================================================="
