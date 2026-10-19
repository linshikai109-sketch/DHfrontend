import { BookOpen, Layers, Map, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router';

// Link identity follows the page. Incomplete setup is handled by route guards.
const pages = [
  { to: '/john/workbench', label: '工作台', Icon: MessageSquare },
  { to: '/john/report', label: '项目蓝图', Icon: Map },
  { to: '/john/quest', label: 'Quest', Icon: Layers },
  { to: '/john/profile', label: '企业概览', Icon: BookOpen },
];

export function JohnNavigationLinks({ icons = false }: { icons?: boolean }) {
  return pages.map(({ to, label, Icon }) => (
    <NavLink key={to} to={to} end title={icons ? label : undefined}>
      {icons ? <><Icon size={19} /><span>{label}</span></> : label}
    </NavLink>
  ));
}
