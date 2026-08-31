let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });
};

const emitNewAlert = (alert) => {
  if (!ioInstance) return;
  ioInstance.emit('new_alert', alert);
};

const emitLoginEvent = (loginEvent) => {
  if (!ioInstance) return;
  ioInstance.emit('login_event', loginEvent);
};

const emitFileEvent = (fileEvent) => {
  if (!ioInstance) return;
  ioInstance.emit('file_event', fileEvent);
};

const emitDashboardRefresh = () => {
  if (!ioInstance) return;
  ioInstance.emit('dashboard_refresh');
};

module.exports = { initSocket, emitNewAlert, emitLoginEvent, emitFileEvent, emitDashboardRefresh };
