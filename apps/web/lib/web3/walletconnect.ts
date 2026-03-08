import { SignClient } from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';
import { ethers } from 'ethers';

type SignClientInstance = InstanceType<typeof SignClient>;

export interface WalletConnectConnection {
    provider: ethers.JsonRpcProvider;
    address: string;
    chainId: number;
    signClient: SignClientInstance;
    session: any;
}

let signClient: SignClientInstance | null = null;
let modal: WalletConnectModal | null = null;

/**
 * Initialize WalletConnect client
 */
export async function initializeWalletConnect(): Promise<SignClientInstance> {
    if (signClient) {
        return signClient;
    }

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
        throw new Error('WalletConnect Project ID not found');
    }

    signClient = await SignClient.init({
        projectId,
        metadata: {
            name: 'CryptX Portfolio Tracker',
            description: 'Track your crypto portfolio across multiple chains',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://cryptx.app',
            icons: ['https://cryptx.app/icon.png'],
        },
    });

    return signClient;
}

/**
 * Initialize WalletConnect modal
 */
function initializeModal(): WalletConnectModal {
    if (!modal) {
        const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
        if (!projectId) {
            throw new Error('WalletConnect Project ID not found');
        }

        modal = new WalletConnectModal({
            projectId,
            chains: ['eip155:1', 'eip155:137', 'eip155:56'],
        });
    }
    return modal;
}

/**
 * Connect with WalletConnect
 */
export async function connectWalletConnect(): Promise<WalletConnectConnection> {
    if (!isWalletConnectAvailable()) {
        throw new Error('WalletConnect is not available');
    }

    try {
        const client = await initializeWalletConnect();
        const walletConnectModal = initializeModal();

        // Create pairing proposal
        const { uri, approval } = await client.connect({
            requiredNamespaces: {
                eip155: {
                    methods: [
                        'eth_sign',
                        'eth_signTransaction',
                        'eth_sendTransaction',
                        'eth_signTypedData',
                        'personal_sign',
                        'eth_requestAccounts',
                    ],
                    chains: ['eip155:1', 'eip155:137', 'eip155:56'],
                    events: ['chainChanged', 'accountsChanged'],
                },
            },
        });

        // Open modal for QR code scanning
        if (uri) {
            walletConnectModal.openModal({ uri });
        }

        // Add modal close listener to detect cancellation
        let modalClosed = false;
        const checkModalClosed = setInterval(() => {
            // Check if modal was closed by user
            const modalElement = document.querySelector('wcm-modal');
            if (!modalElement || modalElement.getAttribute('aria-hidden') === 'true') {
                modalClosed = true;
                clearInterval(checkModalClosed);
            }
        }, 500);

        // Wait for session approval with timeout and cancellation detection
        const session = await Promise.race([
            approval(),
            new Promise((_, reject) => {
                // Check for modal closure every 500ms
                const cancelCheck = setInterval(() => {
                    if (modalClosed) {
                        clearInterval(cancelCheck);
                        clearInterval(checkModalClosed);
                        walletConnectModal.closeModal();
                        reject(new Error('User closed the connection modal'));
                    }
                }, 500);
            })
        ]) as any;

        // Clear the interval
        clearInterval(checkModalClosed);

        // Close modal after successful connection
        walletConnectModal.closeModal();

        // Get the first account and chain
        const accounts = session.namespaces.eip155.accounts;
        const account = accounts[0]; // eip155:1:0x...
        const [namespace, chainId, address] = account.split(':');

        // Ensure address is checksummed (EIP-55 compliant)
        const checksummedAddress = ethers.getAddress(address);

        // Create ethers provider with fallback
        const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        const rpcUrl = alchemyKey && alchemyKey !== 'undefined' && !alchemyKey.includes('YOUR')
            ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
            : 'https://eth.llamarpc.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
            staticNetwork: true,
            polling: false
        });

        return {
            provider,
            address: checksummedAddress, // Keep checksummed address (EIP-55 compliant)
            chainId: parseInt(chainId),
            signClient: client,
            session,
        };
    } catch (error: any) {
        console.error('WalletConnect connection error:', error);

        // Make sure WalletConnect modal is closed on error
        if (modal) {
            modal.closeModal();
        }

        // Re-throw the actual error message or provide a helpful one
        if (error.message?.includes('timeout')) {
            throw error; // Keep the timeout message
        }
        if (error.message?.includes('closed')) {
            throw new Error('Connection cancelled by user');
        }
        throw new Error('Failed to connect with WalletConnect. Please try again.');
    }
}

/**
 * Sign message with WalletConnect
 */
export async function signMessageWithWalletConnect(
    client: SignClientInstance,
    session: any,
    message: string,
    address: string
): Promise<string> {
    try {
        const result = await client.request({
            topic: session.topic,
            chainId: 'eip155:1', // Use Ethereum for signing
            request: {
                method: 'personal_sign',
                params: [message, address],
            },
        });

        return result as string;
    } catch (error) {
        console.error('WalletConnect sign error:', error);
        throw new Error('Failed to sign message with WalletConnect');
    }
}

/**
 * Disconnect WalletConnect session
 */
export async function disconnectWalletConnect(
    client: SignClientInstance,
    session: any
): Promise<void> {
    try {
        await client.disconnect({
            topic: session.topic,
            reason: {
                code: 6000,
                message: 'USER_DISCONNECTED',
            },
        });
    } catch (error) {
        console.error('WalletConnect disconnect error:', error);
    }
}

/**
 * Check if WalletConnect is available
 */
export function isWalletConnectAvailable(): boolean {
    return typeof window !== 'undefined' &&
        !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
}
