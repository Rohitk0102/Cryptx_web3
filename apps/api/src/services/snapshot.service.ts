import { CronJob } from 'cron';
import { generateSnapshot } from './portfolio.service';
import prisma from '../utils/prisma';

let snapshotJob: CronJob | null = null;

/**
 * Start the portfolio snapshot scheduler
 * Runs every hour at :00 to create portfolio snapshots for all active users
 */
export function startSnapshotScheduler() {
    if (snapshotJob) {
        console.log('⚠️  Snapshot scheduler already running');
        return;
    }

    // Run every hour at :00 minutes
    snapshotJob = new CronJob('0 * * * *', async () => {
        console.log('📸 Running portfolio snapshot job...');

        try {
            // Get all users with active wallets
            const users = await prisma.user.findMany({
                where: {
                    wallets: {
                        some: { isActive: true }
                    }
                },
                select: { id: true }
            });

            let successCount = 0;
            let failCount = 0;

            for (const user of users) {
                try {
                    await generateSnapshot(user.id);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to create snapshot for user ${user.id}:`, error);
                    failCount++;
                }
            }

            console.log(`✅ Snapshot job complete: ${successCount} successful, ${failCount} failed`);
        } catch (error) {
            console.error('❌ Snapshot job error:', error);
        }
    });

    snapshotJob.start();
    console.log('📸 Snapshot scheduler started (runs every hour at :00)');
}

/**
 * Stop the portfolio snapshot scheduler
 */
export function stopSnapshotScheduler() {
    if (snapshotJob) {
        snapshotJob.stop();
        snapshotJob = null;
        console.log('🛑 Snapshot scheduler stopped');
    }
}

/**
 * Manually trigger a snapshot for all users
 */
export async function triggerManualSnapshot() {
    console.log('📸 Triggering manual snapshot for all users...');

    const users = await prisma.user.findMany({
        where: {
            wallets: {
                some: { isActive: true }
            }
        },
        select: { id: true }
    });

    const results = await Promise.allSettled(
        users.map(user => generateSnapshot(user.id))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Manual snapshot complete: ${successCount} successful, ${failCount} failed`);

    return { successCount, failCount, total: users.length };
}
