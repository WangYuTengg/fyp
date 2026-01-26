import { useEffect, useState, useCallback } from 'react';

type TimerProps = {
  startedAt: string;
  timeLimitMinutes: number;
  onTimeUp: () => void;
};

export function Timer({ startedAt, timeLimitMinutes, onTimeUp }: TimerProps) {
  const calculateRemaining = useCallback(() => {
    const startTime = new Date(startedAt).getTime();
    const endTime = startTime + timeLimitMinutes * 60 * 1000;
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    return remaining;
  }, [startedAt, timeLimitMinutes]);

  const [secondsRemaining, setSecondsRemaining] = useState(() => calculateRemaining());
  const [hasWarned, setHasWarned] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);

      // Warn when 5 minutes remaining
      if (remaining <= 300 && remaining > 0 && !hasWarned) {
        setHasWarned(true);
        alert('⏰ 5 minutes remaining!');
      }

      // Time's up
      if (remaining === 0) {
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, hasWarned, onTimeUp]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const isLowTime = secondsRemaining <= 300 && secondsRemaining > 0;

  return (
    <div
      className={`px-4 py-2 rounded-lg font-mono text-lg font-bold ${
        secondsRemaining === 0
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
  );
}
