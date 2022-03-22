import { WarpAdapter } from '../main';

export abstract class Encryption {
    public static async decrypt(adapter: WarpAdapter, value: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                adapter.getForeignObject('system.config', (err, obj) => {
                    const result = Encryption._decrypt(
                        obj && obj.native && obj.native.secret ? obj.native.secret : 'Zgfr56gFe87jJOM',
                        value,
                    );
                    resolve(result);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    private static _decrypt(key: string, value: string): string {
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    }
}