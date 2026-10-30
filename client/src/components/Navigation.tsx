import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  Smartphone,
  History,
  Users,
  Palette,
  Radio,
} from 'lucide-react';

export type NavTabId =
  | 'overview'
  | 'spam-caller'
  | 'receiver-end'
  | 'logs'
  | 'subscribers'
  | 'email-studio';

interface NavigationProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  logsCount?: number;
  subscribersCount?: number;
  activeCallStatus?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  logsCount,
  subscribersCount,
  activeCallStatus,
}) => {
  const tabs: Array<{
    id: NavTabId;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={17} />,
    },
    {
      id: 'spam-caller',
      label: 'Spam Caller',
      icon: <PhoneCall size={17} />,
      badge: 'Dialer',
    },
    {
      id: 'receiver-end',
      label: 'Receiver End',
      icon: <Smartphone size={17} />,
      badge:
        activeCallStatus === 'Ringing' || activeCallStatus === 'Calling'
          ? 'Ringing...'
          : activeCallStatus === 'Connected'
          ? 'In Call'
          : undefined,
      badgeColor:
        activeCallStatus === 'Ringing' || activeCallStatus === 'Calling'
          ? '#ef4444'
          : activeCallStatus === 'Connected'
          ? '#22c55e'
          : undefined,
    },
    {
      id: 'logs',
      label: 'Call Logs',
      icon: <History size={17} />,
      badge: logsCount !== undefined ? logsCount : undefined,
    },
    {
      id: 'subscribers',
      label: 'Subscribers',
      icon: <Users size={17} />,
      badge: subscribersCount !== undefined ? subscribersCount : undefined,
    },
    {
      id: 'email-studio',
      label: 'Email Customization',
      icon: <Palette size={17} />,
    },
  ];

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className="tab-badge"
                style={
                  tab.badgeColor
                    ? { background: tab.badgeColor, color: '#ffffff', animation: 'pulse-status 1.2s infinite' }
                    : undefined
                }
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
