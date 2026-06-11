/** Run: pnpm --dir harness exec tsx lib/cloudinary-upload.test.ts */
import { dirname } from 'node:path';
import { assert, createTestRunner } from './test-utils';
import { parseCloudinaryUrl, platformUploadEnv, platformUploadFailureMessage } from './cloudinary-upload';

const { test, done } = createTestRunner();

test('parseCloudinaryUrl: extracts the platform script secure_url line', () => {
  assert.equal(
    parseCloudinaryUrl('✅ Success: cover.png → https://res.cloudinary.com/infinex/image/upload/v1/blog/cover.png\n'),
    'https://res.cloudinary.com/infinex/image/upload/v1/blog/cover.png',
  );
});

test('parseCloudinaryUrl: null when the script produced no upload URL', () => {
  assert.equal(parseCloudinaryUrl('⚠️  No image files found in the specified folder.'), null);
});

test('platformUploadEnv: points the platform script at the staged one-file folder', () => {
  const localPath = '/tmp/cf-img-test/cover.png';
  const env = platformUploadEnv(localPath);
  assert.equal(env.UPLOAD_FROM_FOLDER, dirname(localPath));
  assert.equal(env.CLOUDINARY_FOLDER, 'blog');
  assert.equal(env.OVERWRITE, 'true');
  assert.equal(env.PARALLEL_UPLOADS, 'false');
  assert.equal(env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_CLOUD_NAME || 'infinex');
});

test('platformUploadFailureMessage: classifies missing platform deps', () => {
  assert.match(
    platformUploadFailureMessage('sh: tsx: command not found'),
    /Platform script deps are missing/,
  );
});

test('platformUploadFailureMessage: classifies missing Cloudinary credentials', () => {
  assert.match(
    platformUploadFailureMessage('AssertionError \\[ERR_ASSERTION\\]: CLOUDINARY_API_KEY is required'),
    /Cloudinary credentials are missing/,
  );
});

done();
