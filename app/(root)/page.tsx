import TotalBalanceBox from '@/components/TotalBalanceBox';
import HeaderBox from '@/components/HeaderBox';
import RightSidebar from '@/components/RightSidebar';
import { getLoggedInUser } from '@/lib/actions/user.actions';

const Home = async () => {
    const loggedIn = await getLoggedInUser();

    return (
        <section className='home'>
            <div className='home-content'>

                <header className='home-header'>
                    <HeaderBox 
                    type="greeting"
                    title="Hi,"
                    user={loggedIn?.name || 'Guest'}
                    subtext="Welcome back to BankX, your secure financial hub. Let’s make today a productive one!
"
                    />

                    <TotalBalanceBox
                    accounts={[]}
                    totalBanks={1}
                    totalCurrentBalance={1250.35}
                    />
                </header>

                RECENT TRANSACTIONS
            </div>

            {/* Right Hand Side data */}
            <RightSidebar
            user={loggedIn}
            transactions={[]}
            banks={[{currentBalance: 123.50}, {currentBalance: 100.10}]}
            />
        </section>
    )
}

export default Home;
