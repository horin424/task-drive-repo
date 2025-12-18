import { CosmosClient, Database, Container, ItemDefinition, PatchOperation, RequestOptions } from '@azure/cosmos';

// Environment variables
const endpoint = process.env.COSMOS_DB_ENDPOINT || '';
const key = process.env.COSMOS_DB_KEY || '';
const databaseName = process.env.COSMOS_DB_DATABASE_NAME || 'AppDb';

// Container names
export const CONTAINERS = {
  ORGANIZATIONS: 'Organizations',
  USERS: 'Users',
  SESSIONS: 'ProcessingSessions',
};

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;

/**
 * Initialize and return the Cosmos DB client
 */
export const getCosmosClient = (): CosmosClient => {
  if (!cosmosClient) {
    if (!endpoint || !key) {
      throw new Error('COSMOS_DB_ENDPOINT and COSMOS_DB_KEY must be set');
    }
    cosmosClient = new CosmosClient({ endpoint, key });
  }
  return cosmosClient;
};

/**
 * Get the database instance
 */
export const getDatabase = (): Database => {
  if (!database) {
    database = getCosmosClient().database(databaseName);
  }
  return database;
};

/**
 * Get a container by name
 */
export const getContainer = (containerName: string): Container => {
  return getDatabase().container(containerName);
};

/**
 * Helper: Get Organizations container
 */
export const getOrganizationsContainer = (): Container => {
  return getContainer(CONTAINERS.ORGANIZATIONS);
};

/**
 * Helper: Get Users container
 */
export const getUsersContainer = (): Container => {
  return getContainer(CONTAINERS.USERS);
};

/**
 * Helper: Get Sessions container
 */
export const getSessionsContainer = (): Container => {
  return getContainer(CONTAINERS.SESSIONS);
};

/**
 * Create or update an item in a container
 */
export const upsertItem = async <T extends ItemDefinition>(
  containerName: string,
  item: T
): Promise<T> => {
  const container = getContainer(containerName);
  const { resource } = await container.items.upsert<T>(item);
  return resource as T;
};

/**
 * Get an item by id and partition key
 */
export const getItem = async <T extends ItemDefinition = ItemDefinition>(
  containerName: string,
  id: string,
  partitionKey: string
): Promise<T | null> => {
  const container = getContainer(containerName);
  try {
    const { resource } = await container.item(id, partitionKey).read<T>();
    return resource || null;
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Delete an item by id and partition key
 */
export const deleteItem = async (
  containerName: string,
  id: string,
  partitionKey: string
): Promise<void> => {
  const container = getContainer(containerName);
  await container.item(id, partitionKey).delete();
};

/**
 * Query items in a container
 */
export const queryItems = async <T extends ItemDefinition = ItemDefinition>(
  containerName: string,
  query: string,
  parameters?: { name: string; value: any }[]
): Promise<T[]> => {
  const container = getContainer(containerName);
  const querySpec = {
    query,
    parameters,
  };
  const { resources } = await container.items.query<T>(querySpec).fetchAll();
  return resources;
};

/**
 * Patch (partially update) an item
 */
export const patchItem = async <T extends ItemDefinition = ItemDefinition>(
  containerName: string,
  id: string,
  partitionKey: string,
  operations: PatchOperation[],
  options?: RequestOptions
): Promise<T> => {
  const container = getContainer(containerName);
  const { resource } = await container.item(id, partitionKey).patch(operations, options);
  return resource as T;
};
