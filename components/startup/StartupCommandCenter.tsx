'use client';

import React from 'react';
import AgentOSDashboard from './AgentOSDashboard';

interface StartupCommandCenterProps {
  projectId: string;
}

export default function StartupCommandCenter({ projectId }: StartupCommandCenterProps) {
  return <AgentOSDashboard projectId={projectId} />;
}

