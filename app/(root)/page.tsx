import TotalBalanceBox from '@/components/TotalBalanceBox';
import HeaderBox from '@/components/HeaderBox';
import RightSidebar from '@/components/RightSidebar';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import { getAccount, getAccounts } from '@/lib/actions/bank.actions';
import RecentTransactions from '@/components/RecentTransactions';
// import RecentTransactions from '@/components/RecentTransactions';

/**
 * Home component renders the Home page of the BankX application.
 * It fetches user and account information and displays it using various child components
 *
 * @param {Object} searchParams - The search parameters for the Home page.
 * @param {string} [searchParams.id] - The ID of a specific account to fetch details for.
 * @param {string} [searchParams.page] - The current page number
 *
 * @returns {JSX.Element} - The JSX for the Home page, including a header, total balance box, and a right sidebar.
 */

const Home = async ({ searchParams: { id, page } }: SearchParamProps) => {
  // Converts page to string or set as 1 by default
  const currentPage = Number(page as string) || 1;

  // Fetch the currently logged-in user
  const loggedIn = await getLoggedInUser();

  // Fetch all accounts associated with the logged-in user
  const accounts = await getAccounts({
    userId: loggedIn.$id,
  });

  if (!accounts) return; // return null if no account found

  // Extract account data from the response
  const accountData = accounts?.data;

  // Fetch details for a specific account based on privided ID or defaults to the first account
  const appwriteItemId = (id as string) || accountData[0]?.appwriteItemId;

  const account = await getAccount({ appwriteItemId });

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox
            type="greeting"
            title={`Hi, ${loggedIn?.firstName || 'Guest'} 👋`}
            subtext={`Welcome back to BankX, ${
              loggedIn?.firstName || 'Guest'
            }! Let's make today a productive one.`}
          />

          <TotalBalanceBox
            accounts={accountData}
            totalBanks={accounts?.totalBanks}
            totalCurrentBalance={accounts?.totalCurrentBalance}
          />
        </header>

        <RecentTransactions
          accounts={accountData}
          transactions={account?.transactions}
          appwriteItemId={appwriteItemId}
          page={currentPage}
        />
      </div>

      {/* Right Hand Side data */}
      <RightSidebar
        user={loggedIn}
        transactions={accounts?.transactions}
        banks={accountData?.slice(0, 2)}
      />
    </section>
  );
};

export default Home;
