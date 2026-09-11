/**
 * Request ownership shared by the generic store and feature stores.
 *
 * The WebSocket fan-out invokes the generic store before feature subscribers.
 * Keeping this registry in its own dependency-free module lets the generic
 * error path recognize an opaque Git/review request id without importing the
 * Git store (which would create a store-module cycle). Retired ids stay
 * recognizable long enough to consume a late error after a timeout,
 * supersession, or disconnect; both sets are bounded for long-lived tabs.
 */

const MAX_RETIRED_REQUESTS = 128;
const activeGitReviewRequests = new Set<string>();
const retiredGitReviewRequests = new Set<string>();
const activeAgentRuntimeRequests = new Set<string>();
const retiredAgentRuntimeRequests = new Set<string>();

export function registerGitReviewRequest(requestId: string): void {
  activeGitReviewRequests.add(requestId);
  retiredGitReviewRequests.delete(requestId);
}

export function retireGitReviewRequest(requestId: string): void {
  activeGitReviewRequests.delete(requestId);
  retiredGitReviewRequests.add(requestId);
  while (retiredGitReviewRequests.size > MAX_RETIRED_REQUESTS) {
    const oldest = retiredGitReviewRequests.values().next().value as string | undefined;
    if (!oldest) break;
    retiredGitReviewRequests.delete(oldest);
  }
}

export function ownsGitReviewRequest(requestId: string): boolean {
  return activeGitReviewRequests.has(requestId) || retiredGitReviewRequests.has(requestId);
}

/**
 * Agent mode/lifecycle/control requests are handled by the generic store too,
 * but their errors must not become assistant transcript messages. Keep their
 * ownership beside the Git registry so late correlated errors remain opaque
 * after a timeout, supersession, or disconnect.
 */
export function registerAgentRuntimeRequest(requestId: string): void {
  activeAgentRuntimeRequests.add(requestId);
  retiredAgentRuntimeRequests.delete(requestId);
}

export function retireAgentRuntimeRequest(requestId: string): void {
  activeAgentRuntimeRequests.delete(requestId);
  retiredAgentRuntimeRequests.add(requestId);
  while (retiredAgentRuntimeRequests.size > MAX_RETIRED_REQUESTS) {
    const oldest = retiredAgentRuntimeRequests.values().next().value as string | undefined;
    if (!oldest) break;
    retiredAgentRuntimeRequests.delete(oldest);
  }
}

export function ownsAgentRuntimeRequest(requestId: string): boolean {
  return activeAgentRuntimeRequests.has(requestId) || retiredAgentRuntimeRequests.has(requestId);
}
