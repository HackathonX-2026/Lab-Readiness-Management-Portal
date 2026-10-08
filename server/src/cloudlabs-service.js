import { config } from './config.js';
import { db } from './db.js';
import { createCloudLabsStore } from './cloudlabs-store.js';
import { createCloudLabsCatalogService } from './cloudlabs-catalog.js';

export const cloudlabsService = createCloudLabsCatalogService({
  config: config.admin, store: createCloudLabsStore(db)
});