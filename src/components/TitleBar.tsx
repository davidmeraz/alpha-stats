import '../App.css'; // Might need some globals if classes are here, otherwise TitleBar handles inline/classes.

export function TitleBar() {
    const handleMinimize = () => {
        if (window.ipcRenderer) window.ipcRenderer.send('window-minimize');
    };
    const handleMaximize = () => {
        if (window.ipcRenderer) window.ipcRenderer.send('window-maximize');
    };
    const handleClose = () => {
        if (window.ipcRenderer) window.ipcRenderer.send('window-close');
    };

    return (
        <div className="title-bar">
            <div className="title-bar-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                ALPHA STATS
            </div>
            <div className="window-controls">
                <button className="window-ctrl-btn" onClick={handleMinimize} tabIndex={-1}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12" /></svg>
                </button>
                <button className="window-ctrl-btn" onClick={handleMaximize} tabIndex={-1}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
                </button>
                <button className="window-ctrl-btn window-ctrl-close" onClick={handleClose} tabIndex={-1}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>
        </div>
    );
}
