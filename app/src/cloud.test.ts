import {it,expect} from 'vitest';
import {validCloudConfig} from './cloud';
it('accepts only HTTPS and a public publishable key',()=>{expect(validCloudConfig('https://example.supabase.co','sb_publishable_example_public_key')).toBe(true);expect(validCloudConfig('http://example.com','sb_publishable_example_public_key')).toBe(false);expect(validCloudConfig('https://example.com','sb_secret_example_private_key')).toBe(false);expect(validCloudConfig('','')).toBe(false)});
