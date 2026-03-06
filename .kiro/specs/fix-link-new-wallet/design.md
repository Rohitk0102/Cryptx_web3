# Design Document: Fix Link New Wallet Functionality

## Overview

This design addresses critical state management issues in the ConnectWallet component's "Link New Wallet" functionality. The current implementation suffers from race conditions, inconsistent error handling, and unreliable modal state management that create a poor user experience.

The solution involves refactoring the state management logic to use a more predictable state machine pattern, eliminating setTimeout-based race conditions, implementing proper error state persistence, and adding frontend duplicate wallet detection.

## Architecture

### Current Architecture Issues

The current implementation has several architectural problems:

1. **Competing State Updates**: Multiple boolean states (`showWalletOptions`, `showDropdown`, `connectingWallet`) are updated independently with setTimeout delays, creating race conditions
2. **Inconsistent Modal Visibility**: The modal visibility logic has special cases for WalletConnect that create inconsistent behavior
3. **Error State Volatility**: Error messages are cleared in the finally block before users can see them
4. **Missing Frontend Validation**: Duplicate wallet checks only happen on the backend, allowing unnecessary API calls

### Proposed Architecture

The refactored architecture will:

1. **Unified Modal State Machine**: Replace boolean flags with a single state machine that tracks modal lifecycle (closed, opening, open, connecting, error, success)
2. **Deterministic State Transitions**: Remove all setTimeout-based state updates and use synchronous state transitions
3. **Error State Preservation**: Maintain error state until explicitly cleared by user action
4. **Frontend Validation Layer**: Add duplicate wallet detection before initiating connection flow

## Components and Interfaces

### State Machine States

```typescript
type ModalState = 
  | { status: 'closed' }
  | { status: 'open' }
  | { status: 'connecting', provider: WalletProvider }
  | { status: 'error', provider: WalletProvider, message: string }
  | { status: 'success' };

type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase';
```

### State Transitions

```typescript
// Valid state transitions:
// closed -> open (user clicks "Link New Wallet")
// open -> connecting (user selects a provider)
// connecting -> error (connection fails)
// connecting -> success (connection succeeds)
// error -> connecting (user retries)
// error -> closed (user closes modal)
// success -> closed (automatic after wallet list refresh)
// open -> closed (user closes modal)
```

### Component Interface Changes

```typescript
interface ConnectWalletState {
  // Replace these three states:
  // showWalletOptions: boolean
  // connectingWallet: string | null
  // error: string
  
  // With single state machine:
  modalState: ModalState;
  
  // Keep existing states:
  showDropdown: boolean;
  wallets: Wallet[];
  loadingWallets: boolean;
}
```

### Helper Functions

```typescript
// Check if wallet address is already connected
function isDuplicateWallet(address: string, existingWallets: Wallet[]): boolean {
  const normalizedAddress = address.toLowerCase();
  return existingWallets.some(w => w.address.toLowerCase() === normalizedAddress);
}

// Determine if modal should be visible
function isModalVisible(modalState: ModalState): boolean {
  return modalState.status !== 'closed';
}

// Determine if provider button should show loading
function isProviderConnecting(modalState: ModalState, provider: WalletProvider): boolean {
  return modalState.status === 'connecting' && modalState.provider === provider;
}

// Determine if provider buttons should be disabled
function areProvidersDisabled(modalState: ModalState): boolean {
  return modalState.status === 'connecting';
}
```

## Data Models

### Modal State Model

The modal state machine replaces three separate boolean/string states with a single discriminated union:

```typescript
type ModalState = 
  | { status: 'closed' }
  | { status: 'open' }
  | { status: 'connecting', provider: WalletProvider }
  | { status: 'error', provider: WalletProvider, message: string }
  | { status: 'success' };
```

**State Descriptions:**

- `closed`: Modal is not visible, no connection in progress
- `open`: Modal is visible, user can select a provider
- `connecting`: Connection attempt in progress for specified provider
- `error`: Connection failed, error message displayed, user can retry
- `success`: Connection succeeded, modal will close after wallet list refresh

### Wallet Address Normalization

All wallet addresses must be normalized to lowercase before comparison:

```typescript
const normalizedAddress = address.toLowerCase();
```

This ensures duplicate detection works correctly regardless of address casing from different wallet providers.

## Error Handling

### Error Categories

1. **Provider Not Installed**: Wallet extension/app not detected
2. **User Rejection**: User cancelled the connection request
3. **Duplicate Wallet**: Wallet already connected (frontend check)
4. **Backend Duplicate**: Wallet already connected (backend check)
5. **Network Error**: API request failed
6. **Unknown Error**: Unexpected error during connection

### Error State Management

When an error occurs:

1. Transition to `{ status: 'error', provider, message }` state
2. Keep modal visible
3. Display error message in modal
4. Allow user to retry (transitions back to `connecting` state)
5. Allow user to close modal (transitions to `closed` state)

Error messages should be user-friendly and actionable:

```typescript
const errorMessages = {
  METAMASK_NOT_INSTALLED: 'MetaMask not detected. Please install the MetaMask extension.',
  USER_REJECTED: 'Connection request was rejected. Please try again.',
  DUPLICATE_WALLET: 'This wallet is already connected to your account.',
  WALLET_ALREADY_EXISTS: 'This wallet is already connected to your account.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNKNOWN: 'Failed to connect wallet. Please try again.'
};
```

### Error Recovery

Users can recover from errors by:

1. **Retry**: Click the same provider button again (if error is transient)
2. **Try Different Provider**: Click a different provider button
3. **Close Modal**: Close the modal and start over
4. **Install Extension**: Follow link to install missing wallet extension

## Testing Strategy

### Unit Tests

Unit tests will verify specific error scenarios and state transitions:

1. Test modal opens when "Link New Wallet" is clicked
2. Test modal closes when close button is clicked
3. Test error message displays when connection fails
4. Test duplicate wallet detection with various address casings
5. Test state cleanup when modal closes
6. Test dropdown closes after modal opens

### Property-Based Tests

Property-based tests will verify universal correctness properties across all possible state transitions and inputs. Each test will run a minimum of 100 iterations with randomized inputs.

The property-based testing library for TypeScript will be **fast-check**.

Each property test must include a comment tag in the format:
```typescript
// Feature: fix-link-new-wallet, Property {number}: {property_text}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Modal Opening Invariant

*For any* component state where the modal is closed, clicking the Link_New_Wallet_Button should transition the modal state to 'open'.

**Validates: Requirements 1.1**

### Property 2: Modal and Dropdown Independence

*For any* sequence of modal state changes and dropdown state changes, the modal state should only change in response to explicit modal actions (open modal, select provider, close modal), and should never change due to dropdown state changes alone.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 3: Error State Structure

*For any* wallet connection failure, the resulting modal state should be of type 'error' with a non-empty error message and the modal should be visible.

**Validates: Requirements 2.1, 2.2**

### Property 4: Error State Retry Capability

*For any* error state, selecting a wallet provider should transition to connecting state without passing through closed state.

**Validates: Requirements 2.3**

### Property 5: Modal Close Cleanup

*For any* modal state (open, connecting, error, success), closing the modal should transition to closed state with no error messages, no loading indicators, and no provider selection.

**Validates: Requirements 2.4, 6.1, 6.2, 6.3**

### Property 6: Success Clears Errors

*For any* transition from error state to success state, the success state should contain no error message.

**Validates: Requirements 2.5**

### Property 7: Duplicate Detection Before API Call

*For any* wallet address that already exists in the wallet list (case-insensitive), attempting to connect that wallet should transition to error state without making an API call.

**Validates: Requirements 3.1, 3.2**

### Property 8: Case-Insensitive Duplicate Detection

*For any* two wallet addresses that differ only in letter casing, they should be considered duplicates during duplicate detection.

**Validates: Requirements 3.3**

### Property 9: Connecting State Disables All Providers

*For any* connecting state (regardless of which provider is connecting), all wallet provider buttons should be disabled.

**Validates: Requirements 3.4, 4.2**

### Property 10: Provider-Specific Loading Indicator

*For any* connecting state with a specific provider, only that provider's button should show a loading indicator.

**Validates: Requirements 4.1**

### Property 11: Connecting State Keeps Modal Visible

*For any* connecting state (regardless of provider), the modal should be visible.

**Validates: Requirements 4.3**

### Property 12: Loading Indicator Only in Connecting State

*For any* modal state, a loading indicator should be visible if and only if the state is 'connecting'.

**Validates: Requirements 4.4, 6.3**

### Property 13: Cancellation Resets Loading

*For any* connecting state, if the connection is cancelled, the resulting state should not be 'connecting'.

**Validates: Requirements 4.5**

### Property 14: Success Flow Sequence

*For any* successful wallet connection, the component should refresh the wallet list, then transition to closed state, and the wallet list should contain the newly connected wallet.

**Validates: Requirements 5.1, 5.2, 5.4**

### Property 15: Refresh Failure Handling

*For any* wallet connection that succeeds but whose wallet list refresh fails, the modal state should transition to error state with an appropriate error message.

**Validates: Requirements 5.3**

### Property 16: Modal Reopen Clean State

*For any* sequence of modal close followed by modal open, the resulting state should be 'open' with no error messages, no loading indicators, and no provider selection.

**Validates: Requirements 6.4**

### Property 17: State Machine Validity

*For any* sequence of valid state transitions, each intermediate state should be one of the defined modal states (closed, open, connecting, error, success), and each transition should follow the allowed transition rules.

**Validates: Requirements 7.1**

### Property 18: Cancellation No Auto-Reopen

*For any* connecting state that transitions to closed state due to cancellation, the modal should not automatically transition back to open state.

**Validates: Requirements 7.2**
