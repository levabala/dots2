declare global {
    interface Window {
        assert: (condition: boolean, message: string, details?: object) => void;
        panic: (message: string, details?: object) => never;
    }
}
