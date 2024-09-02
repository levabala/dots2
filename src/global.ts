declare global {
    interface Window {
        assert: (condition: boolean, message: string, details?: object) => void;
    }
}
