import { useState } from 'react';
import type { TabSwitchEvent } from '../types';

type TabSwitchLogProps = {
  tabSwitches: TabSwitchEvent[];
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function TabSwitchLog({ tabSwitches }: TabSwitchLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tabSwitches.length === 0) return null;

  const totalDuration = tabSwitches.reduce((sum, event) => sum + event.durationMs, 0);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-medium">!</span>
          <span className="text-sm font-medium text-amber-800">
            {tabSwitches.length} tab switch{tabSwitches.length === 1 ? '' : 'es'} detected
          </span>
          <span className="text-xs text-amber-600">
            (total away: {formatDuration(totalDuration)})
          </span>
        </div>
        <span className="text-amber-600 text-sm">
          {isExpanded ? 'Hide' : 'Show'} details
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-1">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-amber-700">#</span>
            <span className="font-medium text-amber-700">Left at</span>
            <span className="font-medium text-amber-700 text-right">Duration</span>
            {tabSwitches.map((event, index) => (
              <TabSwitchRow key={event.leftAt} event={event} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabSwitchRow({ event, index }: { event: TabSwitchEvent; index: number }) {
  return (
    <>
      <span className="text-amber-600">{index + 1}</span>
      <span className="text-amber-800">{new Date(event.leftAt).toLocaleTimeString()}</span>
      <span className="text-amber-800 text-right">{formatDuration(event.durationMs)}</span>
    </>
  );
}
