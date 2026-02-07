import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import RNInstalledApplication from 'react-native-installed-application';

export interface InstalledApp {
    appName: string;
    packageName: string;
    icon?: string;
}

export const useInstalledApps = (includeSystemApps: boolean = false) => {
    const [apps, setApps] = useState<InstalledApp[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadApps();
    }, [includeSystemApps]);

    const loadApps = async () => {
        if (Platform.OS !== 'android') {
            setError("Only supported on Android");
            return;
        }

        setIsLoading(true);
        try {
            // Get apps based on preference
            const installedApps = includeSystemApps
                ? await RNInstalledApplication.getApps()
                : await RNInstalledApplication.getNonSystemApps();

            const formattedApps = installedApps.map((app: any) => ({
                appName: app.appName,
                packageName: app.packageName,
                icon: app.icon // Base64 icon if available
            })).sort((a: InstalledApp, b: InstalledApp) => a.appName.localeCompare(b.appName));

            setApps(formattedApps);
        } catch (err) {
            console.error("Failed to load installed apps", err);
            setError("Failed to load apps");
        } finally {
            setIsLoading(false);
        }
    };

    return { apps, isLoading, error, refetch: loadApps };
};
