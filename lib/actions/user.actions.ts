/**
 * User Actions Module
 * 
 * This modules handles user-related actions such as sign-up and retrieving the currently logged-in user.
 * It integrates with the Appwrite service to create user accounts and manage sessions.
 */

'use server'

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient  } from "../appwrite";
import { cookies } from "next/headers";
import { parseStringify, extractCustomerIdFromUrl, encryptId } from "../utils";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid"
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";
import { plaidClient } from "@/lib/plaid";
import { revalidatePath } from "next/cache";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    const user = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error);
  }
}

/**
 * Signs in a user by creating a session using their email and password.
 * This function interacts wiith the admin client to authenticaate the user.
 * 
 * @param {Object} params - The parameters for signing in.
 * @param {string} params.email - The user's email address.
 * @param {string} params.password - The user's password.
 * 
 * @returns {Promise<Object>} - A promise that resolves to the response of the sign in operation.
 * @throws {Error} - Throws and error if the sign in process fails.
 */
export const signIn = async ( { email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();

    const response = await account.createEmailPasswordSession(email, password);


    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    const user = await getUserInfo({ userId: session.userId });

    return parseStringify(user);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Sign Up a New User
 * 
 * This function registers a new user in the Appwrite backend by creating an account
 * and an email-password-based session. It also sets a secure session cookie.
 * 
 * @param userData - The data needed to create a new user account.
 * @returns {Promise<Object | void>} - The created user account or void if an error occurs.
 */
export const signUp = async ({ password, ...userData }: SignUpParams) => {

  const { email, firstName, lastName } = userData;

  let newUserAccount;

  try {

    // Create an admin client for privileged access to user management
    const { account, database } = await createAdminClient();
    
    // Create a new user account
    newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) throw new Error('Error creating user');

    const dwollaCustomerUrl = await createDwollaCustomer({
      ...userData,
      type: 'personal'
    })

    if (!dwollaCustomerUrl) throw new Error('Error creating Dwolla customer');

    const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        ...userData,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl
      }
    )

    const session = await account.createEmailPasswordSession(email, password);

    // Stores the session in a secure Http-only cookie
    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    // Return the new user account information, parsed for JSON serialization
    return parseStringify(newUser);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Get Logged-In User
 * 
 * This function fetchs the current user's account information using a valid session.
 * If no session is available or an error occurs, it returns null.
 * 
 * @returns {Promise<Object | null>} - The logged-in user's account data or null if not logged in.
 */
export async function getLoggedInUser() {
  try {
    // Create a session client ot access the logged-in user's account
    const { account } = await createSessionClient();

    // Fetch and store the acccount information as user.
    const result = await account.get();
    
    const user = await getUserInfo({ userId: result.$id })

    // Returns the user information
    return parseStringify(user);
  } catch (error) {
    return null;
  }
}

/**
 * This function Logs user out by deleting the appwrite session cookie from the browser.
 * 
 * @returns null if any error occurss during the logout process.
 */
export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete('appwrite-session');

    await account.deleteSession('current');
  } catch (error) {
    return null;
  }
}

/**
 * Creates a link token for the specific user, allowing them to connect their bank account
 * through plaid. The link token is required for initializing the plaid Link flow.
 * 
 * @param {User} user - The user object containing user specific information.
 * 
 * @returns {Promise<object>} - a promise that resolves to an object containing the link token.
 * @throws {Error} - Throws an error if the link token creation fails.
 */
export const createLinkToken = async (user: User) => {
  try {
    const tokenParams = {
      user: {
        client_user_id: user.$id
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ['auth'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    }

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({
      linkToken: response.data.link_token
    })
  } catch (error) {
    console.log(error);
    throw error;
  }
}

/**
 * Creates a bank account document in the database for the specific user and bank account details.
 * 
 * @param {Object} params - The parameter for creating the bank account.
 * @param {string} params.userId - The ID of the usr associated with the bank acccount.
 * @param {string} params.bankId - The ID of the bank.
 * @param {string} params.accountId - The ID of the bank account
 * @param {string} params.accessToken - The access token for the bank account
 * @param {string} params.shareableId - The shareable ID for the bank account.
 * @param {string} params.fundingSourceUrl - The funding source URL for the bank account.
 * 
 * @returns {Promise<Object>} - A promise that resolves to the created bank account document.
 * @throws {Error} - Throws an error if the bank account creation fails.
 */
export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    const bankAccount = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    )

    return parseStringify(bankAccount);
  } catch (error) {
    console.log(error);
  }
}

/**
 * Exchanges a public token for an access token and retrieves account information
 * from plaid. It then creates a processor token for Dwolla and a funding source URL,
 * followed by creating a bank account. Finally, it revalidates the path and returns a success
 * message.
 * 
 * @param {Object} params - The parameters for the function.
 * @param {string} params.publicToken - The public token to exchange.
 * @param {Object} params.user - The user object containing user-specific information.
 * 
 * @returns {Promise<Object>} - A promise that resolves to a success message.
 * @throws {Error} - Throws an error if any step in the process fails.
 */
export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get account information from Plaid, using the access token
    const acccountResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = acccountResponse.data.accounts[0];

    // Create a processor token for Dwolla using the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse = await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

    // Create a funding source URL for the account using the Dwolla customer Id, processor token, and bank name
    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });

    // Throws error if funding URL is not created.
    if (!fundingSourceUrl) throw Error;

    // Create a bankk account using the user ID, item ID, account ID, access token, funding source URL, and shareable ID
    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    // Revalidate the path to reflect the changes
    revalidatePath("/");

    // Return a success message.
    return parseStringify({
      publicTokenExchange: "complete",
    });

  } catch (error) {
    console.error("An error occured while creating exchange token:", error);
    throw error;
  }
}

/**
 * Retrieves the list of banks associtated with a user.
 * 
 * @param userId - The ID of the user whose banks are to be fetched.
 * @returns The list of bank documents or logs an error if otherwise.
 */
export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(banks.documents);
  } catch (error) {
    console.log(error);
  }
}


/**
 * Retrieves a specific bank document by its ID.
 * 
 * @param documentId - The ID of the bank document to be retrieved.
 * @returns The bank document or logs an error if any.
 */
export const getBank = async ({ documentId }: getBankProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('$id', [documentId])]
    )

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error);
  }
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('accountId', [accountId])]
    )

    if(bank.total !== 1) return null;

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}