import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { color: string; size?: number };

/** Same paths as the web app's mobile-tab-bar.tsx, ported to react-native-svg. */
export function GridIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </Svg>
  );
}

export function TasksIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="4" />
      <Path d="m8 12.5 2.5 2.5L16 9.5" />
    </Svg>
  );
}

export function KanbanIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="5.5" height="16" rx="1.8" />
      <Rect x="9.25" y="4" width="5.5" height="10" rx="1.8" />
      <Rect x="15.5" y="4" width="5.5" height="13" rx="1.8" />
    </Svg>
  );
}

export function BellIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 3.2 1.4 5 1.4 5H5.1s1.4-1.8 1.4-5Z" />
      <Path d="M9.8 17.5a2.4 2.4 0 0 0 4.4 0" />
    </Svg>
  );
}

export function MoreIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="5" cy="12" r="1.6" />
      <Circle cx="12" cy="12" r="1.6" />
      <Circle cx="19" cy="12" r="1.6" />
    </Svg>
  );
}

export function RequestsIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="2.5" width="16" height="19" rx="2.5" />
      <Path d="M8 8h8M8 12h8M8 16h4.5" />
    </Svg>
  );
}

export function SparklesIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <Path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </Svg>
  );
}

export function PlusIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function BackIcon({ color = "#1a202c", size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size * 0.6} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}
