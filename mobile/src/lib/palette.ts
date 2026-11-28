import { useColorScheme } from 'nativewind';

// JS-side mirror of the CSS tokens in global.css, for props that cannot take a className
// (icon color, switch trackColor, chart props, placeholderTextColor).
const light = {
    background: '#F7F5F0',
    surface: '#FEFDFB',
    surfaceVariant: '#EFEBE3',
    onSurface: '#1D211E',
    onBackground: '#1D211E',
    onSurfaceVariant: '#5A615D',
    outline: '#DEDAD1',
    primary: '#1F6E5A',
    primaryForeground: '#FBFAF7',
    success: '#186A4B',
    error: '#AA3928',
    warning: '#9A5A0F',
    info: '#1E6482',
};

const dark = {
    background: '#0D1210',
    surface: '#131A17',
    surfaceVariant: '#252E2A',
    onSurface: '#E9EDEA',
    onBackground: '#EFECE5',
    onSurfaceVariant: '#98A6A0',
    outline: '#28322D',
    primary: '#58B596',
    primaryForeground: '#0A1710',
    success: '#4DC0A0',
    error: '#DE7060',
    warning: '#F0B34D',
    info: '#79B4DC',
};

export type Palette = typeof light;

export function usePalette(): Palette {
    const { colorScheme } = useColorScheme();
    return colorScheme === 'dark' ? dark : light;
}
