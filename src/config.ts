export const API_BASE_URL = 'https://onyba.tgastaging.com/api/';
export const Base_image_url = 'https://onyba.tgastaging.com/';





export const formatCount = (val: any, fallback: string) => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    if (!isNaN(num)) {
        return num < 10 && num >= 0 ? `0${num}` : `${num}`;
    }
    return String(val);
};

export const formatCurrency = (val: any, fallback: string) => {
    if (val === undefined || val === null || val === '') return fallback;
    const str = String(val).trim();
    if (str.startsWith('$')) return str;
    const num = Number(str);
    if (!isNaN(num)) {
        return `$${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`;
    }
    return `$${str}`;
};
