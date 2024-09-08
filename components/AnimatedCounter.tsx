'use client';

import { DivideSquareIcon } from 'lucide-react';
import CountUp from 'react-countup';

export const AnimatedCounter = ({ amount } : { amount: number}) => {
  return (
    <div className='w-full'>
        <CountUp
        duration={3}
        decimals={2}
        decimal=','
        prefix='$'
        end={amount} />
    </div>
  )
}
