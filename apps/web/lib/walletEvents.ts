export const WALLET_DATA_CHANGED_EVENT = 'wallets-updated';

export function notifyWalletsChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WALLET_DATA_CHANGED_EVENT));
    }
}
