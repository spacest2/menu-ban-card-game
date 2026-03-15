import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

export function ReviveEffect(props: {
  triggerId: string | null;
  active: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    if (!props.active || !props.triggerId) {
      setVisible(false);
      return;
    }

    setRenderKey((current) => current + 1);
    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 1150);

    return () => window.clearTimeout(timer);
  }, [props.active, props.triggerId]);

  if (!visible || !props.triggerId) {
    return null;
  }

  return (
    <span key={`${props.triggerId}-${renderKey}`} className="revive-burst" aria-hidden="true">
      <span className={cn("revive-wing", "revive-wing-left")} />
      <span className="revive-text">부활!</span>
      <span className={cn("revive-wing", "revive-wing-right")} />
    </span>
  );
}
