import TotalBalanceBox from '@/components/TotalBalanceBox';
import HeaderBox from '@/components/HeaderBox';

const Home = () => {
    const loggedIn = { firstName: 'Frankie' };

    return (
        <section className='home'>
            <div className='home-content'>

                <header className='home-header'>
                    <HeaderBox 
                    type="greeting"
                    title="Hi,"
                    user={`${loggedIn?.firstName} 👋` || 'Guest  👋'}
                    subtext="Welcome back to BankX, your secure financial hub. Let’s make today a productive one!
"
                    />

                    <TotalBalanceBox
                    accounts={[]}
                    totalBanks={1}
                    totalCurrentBalance={1250.35}
                    />
                </header>
            </div>
        </section>
    )
}

export default Home;