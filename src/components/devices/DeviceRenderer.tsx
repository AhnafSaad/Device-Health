import React from 'react';
import { Server } from '../../types';
import { OLTView } from './OLT/OLTView';
import { RouterView } from './Router/RouterView';
import { SwitchView } from './Switch/SwitchView';
import { ServerView } from './Server/ServerView';

export interface DeviceRendererProps {
  server: Server;
  onBack: () => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onRebootServer?: (serverId: string) => void;
  onUpdateServer?: (updated: Server) => void;
}

/**
 * DeviceRenderer - Factory Entry Point
 * 
 * Routes incoming device telemetry state to specialized device views
 * (OLTView, RouterView, SwitchView, ServerView) based on `server.deviceType`.
 */
export const DeviceRenderer: React.FC<DeviceRendererProps> = (props) => {
  const { server } = props;
  const deviceType = server.deviceType || 'Server';

  switch (deviceType) {
    case 'OLT':
      return <OLTView {...props} />;

    case 'Router':
      return <RouterView {...props} />;

    case 'Switch':
      return <SwitchView {...props} />;

    case 'Server':
    default:
      return <ServerView {...props} />;
  }
};

export default DeviceRenderer;
