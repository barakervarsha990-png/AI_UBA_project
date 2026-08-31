import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSocket } from '../services/socket';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const [liveAlerts, setLiveAlerts] = useState([]); // toast queue
  const [refreshTick, setRefreshTick] = useState(0);

  const dismissAlert = useCallback((id) => {
    setLiveAlerts((prev) => prev.filter((a) => a._id !== id));
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onNewAlert = (alert) => {
      setLiveAlerts((prev) => [alert, ...prev].slice(0, 5));
      setTimeout(() => dismissAlert(alert._id), 8000);
    };
    const onRefresh = () => setRefreshTick((t) => t + 1);

    socket.on('new_alert', onNewAlert);
    socket.on('dashboard_refresh', onRefresh);
    socket.on('login_event', onRefresh);
    socket.on('file_event', onRefresh);

    return () => {
      socket.off('new_alert', onNewAlert);
      socket.off('dashboard_refresh', onRefresh);
      socket.off('login_event', onRefresh);
      socket.off('file_event', onRefresh);
    };
  }, [dismissAlert]);

  return (
    <AlertContext.Provider value={{ liveAlerts, dismissAlert, refreshTick }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => useContext(AlertContext);
