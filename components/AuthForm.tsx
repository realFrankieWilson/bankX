'use client'

import React from 'react'
import Image from "next/image"
import Link from "next/link"
import { useState } from 'react'

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import CustomInput from './CustomInput'
import { authFormSchema } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { flushAllTraces } from 'next/dist/trace'
import { useRouter } from 'next/navigation'
import { getLoggedInUser, signIn, signUp } from '@/lib/actions/user.actions'
import PlaidLink from './PlaidLink'


const AuthForm = ({ type }: { type: string }) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const formSchema = authFormSchema(type);

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: ''
    },
  })
  
  // 2. Define a submit handler.
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true)

    try {
      // Sign up with appwrite & create plaid token

      if (type === 'sign-up') {
        const newUser = await signUp(data);
        setUser(newUser);
      }

      if (type === 'sign-in') {
        const response = await signIn({
          email: data.email,
          password: data.password,
        })

        if (response) {
          router.push('/');
        }
      }

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }
    
  return (
    <section className="auth-form">
      <header className="flex flex-col gap-5 md:gap-8">
        <Link href="/" className='cursor-pointer items-center gap-1 flex'>
          <Image
            width={34}
            height={34}
            src='/icons/logo.svg'
            alt='bankX logo'
            className='size-[24px] max-xl:size-14'
          />
          <h1 className="text-26 font-ibm-plex-serif font-bold text-black-1">BankX</h1>
        </Link>

        <div className="flex flex-col gap-1 md:gap-3">
          <h1 className="text-24 lg:text-36 font-semibold text-gray-900">
            {user
              ? 'Link Account'
              : type === 'sign-in'
                ? 'Sign In'
                : 'Sign Up'
            }
            <p className="text-16 font-normal text-gray-600">
              {user
                ? 'Link your account to get started'
                : 'Please enter your details to continue'
              }
            </p>
          </h1>
        </div>
      </header>
      {user ? (
        <div className="flex flex-col gap-4">
          <PlaidLink user={user} variant="primary" />
        </div>
      ): (
        <>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Renders form based on user's request */}
              {type === 'sign-up' && (
                <>
                <div className='flex gap-4'>
                  <CustomInput
                    control={form.control}
                    name="firstName"
                    placeholder='Enter your first name'
                    label="First Name"
                  />
                  <CustomInput
                    control={form.control}
                    name="lastName"
                    placeholder='Enter your last name'
                    label="Last Name"
                  />
                </div>
                <CustomInput
                  control={form.control}
                  name="address1"
                  placeholder='Enter your address'
                  label="Address"
                />
                <CustomInput
                  control={form.control}
                  name="city"
                  placeholder='Enter your city'
                  label="City"
                />
                <div className='flex gap-4'>
                  <CustomInput
                    control={form.control}
                    name="state"
                    placeholder='Example: NY'
                    label="State"
                  />
                    <CustomInput
                    control={form.control}
                    name="postalCode"
                    placeholder='Example: 10001'
                    label="Postal Code"
                  />
                </div>
                <div className="flex gap-4">
                  <CustomInput
                    control={form.control}
                    name="dob"
                    placeholder='YYYY-MM-DD'
                    label="Date Of Birth"
                  />
                  <CustomInput
                    control={form.control}
                    name="ssn"
                    placeholder='Example 1234'
                    label="SSN"
                  />
                </div>
                </>
              )}

              {/* Form input for password field */}
              <CustomInput
                control={form.control}
                name="email"
                placeholder='Enter your email'
                label="Email"
              />

              {/* Form input for password field */}
              <CustomInput
                control={form.control}
                name="password"
                placeholder='Enter your password'
                label="Password"
              />
              <div className="flex flex-col gap-4">
                <Button type="submit" disabled={isLoading} className='form-btn'>
                  {isLoading ? (
                    <>
                      <Loader2 size={20}
                      className='animate-spin'
                      /> &nbsp;
                      Just a sec...
                    </>
                  ) : type === 'sign-in'
                    ? 'Sign In' : 'Sign Up'}
                </Button>
              </div>
            </form>
          </Form>

          <footer className="flex justify-center gap-1">
            <p className='text-14 font-normal text-gray-600'>
              {type === 'sign-in'
              ? "Don't have an account?"
              : "Already have an account"}
            </p>
            <Link href={type === 'sign-in' ? '/sign-up'
              : '/sign-in'} className='form-link'>
                {type === 'sign-up' ? 'Sing In' : 'Sign Up'}
            </Link>
          </footer>
        </>
      )}
    </section>
  )
}

export default AuthForm
