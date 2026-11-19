// Provider-agnostic: receives events already parsed by the webhook route.
type Handler = (userId: string) => Promise<void>;

export const handlers: Record<string, Handler> = {
  subscription_resumed: async () => {},
  subscription_paused: async () => {},
  subscription_unpaused: async () => {},
};
