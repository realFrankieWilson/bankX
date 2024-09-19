/**
 * User Actions Module
 * 
 * This modules handles user-related actions such as sign-up and retrieving the currently logged-in user.
 * It integrates with the Appwrite service to create user accounts and manage sessions.
 */

'use server'

import { ID } from "node-appwrite";
import { createAdminClient, createSessionClient  } from "../appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { plaidClient } from '@/lib/plaid';
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";
import { Database } from "lucide-react";

const {
  APPRITE_DATABASE_ID : DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID : USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID : BANK_COLLECTION_ID,

} = process.env;

export const signIn = async ( { email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();

    const response = await account.createEmailPasswordSession(email, password);

    return parseStringify(response);
  } catch (error) {
    console.error('Error signing in:', error);
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
export const signUp = async (userData: SignUpParams) => {
  const { email, password, firstName, lastName } = userData;

  let newUserAccount;

  try {
    // Create an admin client for privileged access to user management
    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(), 
      email, 
      password, 
      `${firstName} ${lastName}`
    );
    
    if(!newUserAccount) throw new Error('Error creating user')

    const dwollaCustomerUrl = await createDwollaCustomer({
      ...userData,
      type: 'personal'
    })
  
    if(!dwollaCustomerUrl) throw new Error('Error creating Dwolla customer')
  
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

    // Create a session for the newly created user
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
    console.error('Error during sign-up:', error);
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
    const user = await account.get();

    // Returns the user information
    return parseStringify(user);
  } catch (error) {
    console.log(error);
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
 * This function creates a Plaid link token for a user, which is needed to connect bank accounts.
 * 
 * It takes user information, sends it to the Plaid API, and returns the generated link token.
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

    return parseStringify({ linkToken: response.data.link_token })
  } catch (error) {
    console.log(error);
  }
}

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
 * This function exchanges a Plaid public token for an access token, retrieves account info, creates a processor token.
 * 
 * adds a funding source, and creates a bank account. It returns a success message or logs an error if one occurs.
 */
export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // Exchange the provided Plaid public token for an access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    // Use the access token to retrieve account details from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    const accountData = accountsResponse.data.accounts[0];

    // Generate a Dwolla processor token with the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse = await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

    // Attach a funding source to the Dwolla customer using the processor token and bank name
    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });

    // If no funding source URL is returned, trigger an error
    if (!fundingSourceUrl) throw Error;

    // Register a bank account in the system using various details such as userId, itemId, access token and account ID
    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    // Refresh the path once the bank account has been successfully created
    revalidatePath("/");

    // Send a completion message indicating the token exchange process is done
    return parseStringify({
      publicTokenExchange: "complete",
    });

  } catch (error) {
    // Log any errors encountered during the process
    console.error("An error occurred while exchanging the token:", error);
  }
}