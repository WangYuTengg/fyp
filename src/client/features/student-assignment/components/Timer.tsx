import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

type WarningLevel = 'info' | 'warning' | 'urgent';

type TimerWarning = {
  thresholdSeconds: number;
  level: WarningLevel;
  message: string;
  dismissible: boolean;
  playSound: boolean;
};

const DEFAULT_WARNINGS: readonly TimerWarning[] = [
  {
    thresholdSeconds: 15 * 60,
    level: 'info',
    message: '15 minutes remaining',
    dismissible: true,
    playSound: false,
  },
  {
    thresholdSeconds: 5 * 60,
    level: 'warning',
    message: '5 minutes remaining',
    dismissible: false,
    playSound: false,
  },
  {
    thresholdSeconds: 1 * 60,
    level: 'urgent',
    message: '1 minute remaining!',
    dismissible: false,
    playSound: true,
  },
] as const;

type TimerProps = {
  startedAt: string;
  timeLimitMinutes: number;
  onTimeUp: () => void;
  warnings?: readonly TimerWarning[];
};

const BANNER_STYLES: Record<WarningLevel, string> = {
  info: 'bg-blue-50 border-blue-300 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  urgent: 'bg-red-50 border-red-300 text-red-800 animate-pulse',
};

const BANNER_ICONS: Record<WarningLevel, string> = {
  info: '\u2139\uFE0F',
  warning: '\u26A0\uFE0F',
  urgent: '\uD83D\uDD34',
};

const playBeep = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Play a second beep after a short pause
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    oscillator2.frequency.value = 880;
    oscillator2.type = 'sine';
    gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.6);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.1);
    oscillator2.start(audioContext.currentTime + 0.6);
    oscillator2.stop(audioContext.currentTime + 1.1);
  } catch {
    // Browser may block audio without user interaction — silently ignore
  }
};

export function Timer({ startedAt, timeLimitMinutes, onTimeUp, warnings = DEFAULT_WARNINGS }: TimerProps) {
  const calculateRemaining = useCallback(() => {
    const startTime = new Date(startedAt).getTime();
    const endTime = startTime + timeLimitMinutes * 60 * 1000;
    const now = Date.now();
    return Math.max(0, Math.floor((endTime - now) / 1000));
  }, [startedAt, timeLimitMinutes]);

  const [secondsRemaining, setSecondsRemaining] = useState(() => calculateRemaining());
  const [triggeredThresholds, setTriggeredThresholds] = useState<Set<number>>(() => new Set());
  const [dismissedThresholds, setDismissedThresholds] = useState<Set<number>>(() => new Set());
  const triggeredRef = useRef<Set<number>>(new Set());
  const soundPlayedRef = useRef<Set<number>>(new Set());

  // Memoize sorted warnings to keep stable reference
  const sortedWarnings = useMemo(
    () => [...warnings].sort((a, b) => b.thresholdSeconds - a.thresholdSeconds),
    [warnings],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);

      // Check each warning threshold
      for (const warning of sortedWarnings) {
        if (
          remaining <= warning.thresholdSeconds &&
          remaining > 0 &&
          !triggeredRef.current.has(warning.thresholdSeconds)
        ) {
          triggeredRef.current.add(warning.thresholdSeconds);
          setTriggeredThresholds((prev) => new Set([...prev, warning.thresholdSeconds]));

          if (warning.playSound && !soundPlayedRef.current.has(warning.thresholdSeconds)) {
            soundPlayedRef.current.add(warning.thresholdSeconds);
            playBeep();
          }
        }
      }

      if (remaining === 0) {
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, onTimeUp, sortedWarnings]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const handleDismiss = (thresholdSeconds: number) => {
    setDismissedThresholds((prev) => new Set([...prev, thresholdSeconds]));
  };

  // Find the most urgent active (triggered + not dismissed) warning
  // sortedWarnings is descending by threshold; reverse to check lowest (most urgent) first
  const activeWarning = [...sortedWarnings]
    .reverse()
    .find(
      (w) =>
        triggeredThresholds.has(w.thresholdSeconds) &&
        !dismissedThresholds.has(w.thresholdSeconds),
    );

  const isLowTime = secondsRemaining <= 300 && secondsRemaining > 0;
  const isUrgent = secondsRemaining <= 60 && secondsRemaining > 0;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Timer display */}
      <div
        className={`px-4 py-2 rounded-lg font-mono text-lg font-bold ${
          secondsRemaining === 0
            ? 'bg-red-100 text-red-800'
            : isUrgent
              ? 'bg-red-100 text-red-800'
              : isLowTime
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
        }`}
      >
        {secondsRemaining === 0 ? (
          "Time's Up!"
        ) : (
          <>
            <span className="text-sm font-normal">Time Remaining: </span>
            {formatTime(secondsRemaining)}
          </>
        )}
      </div>

      {/* Warning banner */}
      {activeWarning && (
        <div
          className={`w-full max-w-2xl border rounded-lg px-4 py-3 flex items-center justify-between ${BANNER_STYLES[activeWarning.level]}`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              {BANNER_ICONS[activeWarning.level]}
            </span>
            <span className="font-medium text-sm">{activeWarning.message}</span>
          </div>
          {activeWarning.dismissible && (
            <button
              onClick={() => handleDismiss(activeWarning.thresholdSeconds)}
              className="ml-4 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss warning"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
