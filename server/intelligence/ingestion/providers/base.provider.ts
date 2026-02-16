import * as crypto from 'crypto';
import {
    DataProviderInterface,
    DataProvider,
    FetchOptions,
    RawArticle,
    RateLimitStatus
} from '../../core/types';

/**
 * Abstract base class for all data providers
 */
export abstract class BaseProvider implements DataProviderInterface {
    public abstract name: DataProvider;

    protected remainingCalls: number = 0;
    protected resetAt: Date = new Date();

    public abstract isAvailable(): Promise<boolean>;

    public abstract fetchArticles(options: FetchOptions): Promise<RawArticle[]>;

    public getRateLimitStatus(): RateLimitStatus {
        return {
            remaining: this.remainingCalls,
            resetAt: this.resetAt,
            isLimited: this.remainingCalls <= 0 && new Date() < this.resetAt
        };
    }

    /**
     * Helper to generate a unique ID for an article based on its URL
     */
    protected generateId(url: string): string {
        return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
    }
}
