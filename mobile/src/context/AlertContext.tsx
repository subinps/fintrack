import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomAlert from '../components/CustomAlert';

type AlertButton = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

type AlertOptions = {
    title: string;
    message: string;
    buttons?: AlertButton[];
};

type AlertContextType = {
    showAlert: (title: string, message: string, buttons?: AlertButton[]) => void;
    hideAlert: () => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertOptions>({ title: '', message: '', buttons: [] });

    const showAlert = useCallback((title: string, message: string, buttons?: AlertButton[]) => {
        setConfig({ title, message, buttons: buttons || [{ text: 'OK', style: 'default' }] });
        setVisible(true);
    }, []);

    const hideAlert = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <CustomAlert
                visible={visible}
                title={config.title}
                message={config.message}
                buttons={config.buttons}
                onClose={hideAlert}
            />
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}
