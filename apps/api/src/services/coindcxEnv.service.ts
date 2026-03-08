import { CoinDCXClient } from './coindcxClient';

export class CoinDCXEnvConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CoinDCXEnvConfigError';
    }
}

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new CoinDCXEnvConfigError(`Missing required environment variable: ${name}`);
    }

    return value;
}

export function createCoinDCXEnvClient(): CoinDCXClient {
    return new CoinDCXClient({
        apiKey: requireEnv('COINDCX_API_KEY'),
        apiSecret: requireEnv('COINDCX_API_SECRET'),
        baseUrl: process.env.COINDCX_BASE_URL?.trim() || 'https://api.coindcx.com',
    });
}
