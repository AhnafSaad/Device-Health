#!/bin/bash
SRC=$(sudo /usr/bin/ipmitool sensor 2>/dev/null)
if [ -z "$SRC" ]; then
  SRC=$(sudo /usr/bin/ipmitool sdr elist full 2>/dev/null)
fi
if [ -z "$SRC" ]; then
  echo '{"temp_max":null,"temp_inlet":null,"fans":[],"psu":[],"ipmi_error":"no_response"}'
  exit 0
fi

# Extract Dell total power consumption (e.g. 252 Watts)
TOTAL_WATTS=$(echo "$SRC" | awk -F'|' '
tolower($1) ~ /(pwr consumption|power consumption|system board pwr)/ && tolower($3) ~ /watts/ {
  gsub(/[^0-9.]/,"",$2); print int($2); exit
}')
if [ -z "$TOTAL_WATTS" ]; then
  TOTAL_WATTS=$(sudo /usr/bin/ipmitool dcmi power reading 2>/dev/null | awk -F':' '/Instantaneous power reading/{gsub(/[^0-9]/,"",$2); print int($2); exit}')
fi

echo "$SRC" | awk -v total_pwr="$TOTAL_WATTS" -F'|' '
function trim(s){gsub(/^[ \t]+|[ \t]+$/,"",s); return s}
function mapst(s){ s=tolower(s); if(s=="ok"||s=="0x0100"||s=="0x01"||s=="0x0180") return "ok"; if(s=="nc") return "warning"; if(s=="cr"||s=="nr"||s=="fail"||s=="0x02"||s=="0x04") return "critical"; return "ok" }
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
