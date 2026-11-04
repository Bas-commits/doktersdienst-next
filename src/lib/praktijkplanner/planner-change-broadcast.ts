const CHANNEL_NAME = 'praktijkplanner-changes';

export type PlannerChangeMessage = {
  idwaarneemgroep: number;
  at: number;
};

type PlannerChangeHandler = (message: PlannerChangeMessage) => void;

function canUseBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

export function notifyPlannerChanged(idwaarneemgroep: number): void {
  if (!canUseBroadcastChannel()) return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const message: PlannerChangeMessage = { idwaarneemgroep, at: Date.now() };
    channel.postMessage(message);
    channel.close();
  } catch {
    // Ignore — BroadcastChannel may be unavailable in some environments.
  }
}

export function subscribePlannerChanged(
  idwaarneemgroep: number,
  handler: PlannerChangeHandler
): () => void {
  if (!canUseBroadcastChannel()) return () => undefined;

  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return () => undefined;
  }

  channel.onmessage = (event: MessageEvent<PlannerChangeMessage>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.idwaarneemgroep !== idwaarneemgroep) return;
    handler(data);
  };

  return () => {
    channel.close();
  };
}
