export const floor1Str = (val: number) => (Math.floor(val * 10) / 10).toFixed(1);
export const floor1 = (val: number) => Math.floor(val * 10) / 10;
export const floor2Str = (val: number) => (Math.floor(val * 100) / 100).toFixed(2);

export const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(2)}`;
};

export const formatDayFull = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
