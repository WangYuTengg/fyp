import { useCallback, useEffect, useRef, useState } from 'react';
import { submissionsApi } from '../../../lib/api';

type UseFocusMonitorOptions = {
  submissionId: string | undefined;
  monitorFocus: boolean;
  maxTabSwitches: number | null;
  isSubmitted: boolean;
  onAutoSubmit: () => void;
};

export function useFocusMonitor({
  submissionId,
  monitorFocus,
  maxTabSwitches,
  isSubmitted,
  onAutoSubmit,
}: UseFocusMonitorOptions) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const leftAtRef = useRef<string | null>(null);
  const hasShownWarningRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!monitorFocus || !submissionId || isSubmitted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        leftAtRef.current = new Date().toISOString();
      } else if (leftAtRef.current) {
        const returnedAt = new Date().toISOString();
        const durationMs = new Date(returnedAt).getTime() - new Date(leftAtRef.current).getTime();

        submissionsApi
          .reportFocusEvent(submissionId, {
            leftAt: leftAtRef.current,
            returnedAt,
            durationMs,
          })
          .then((response) => {
            const count = response.data.tabSwitchCount;
            setTabSwitchCount(count);

            if (!hasShownWarningRef.current) {
              hasShownWarningRef.current = true;
              setShowWarning(true);
              setTimeout(() => setShowWarning(false), 5000);
            }

            if (response.data.shouldAutoSubmit && !autoSubmitTriggeredRef.current) {
              autoSubmitTriggeredRef.current = true;
              onAutoSubmit();
            }
          })
          .catch(() => {
            // Silently fail — focus events are best-effort
          });

        leftAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [monitorFocus, submissionId, isSubmitted, onAutoSubmit]);

  return {
    tabSwitchCount,
    maxTabSwitches,
    showWarning,
    dismissWarning,
    isMonitoring: monitorFocus,
  };
}
