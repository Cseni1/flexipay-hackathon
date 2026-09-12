#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, symbol_short, token, Address, Env,
    String, Symbol,
};

#[contract]
pub struct PayShift;

const PAID: Symbol = symbol_short!("PAID");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyPaid = 1,
    InvalidAmount = 2,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShiftPaid {
    #[topic]
    pub shift_id: String,
    pub worker: Address,
    pub amount: i128,
}

#[contractimpl]
impl PayShift {
    /// Authorise and pay a completed shift once.
    /// Employer must authorise; duplicate shift IDs are rejected.
    pub fn pay_shift(
        env: Env,
        shift_id: String,
        employer: Address,
        worker: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        employer.require_auth();

        let key = (PAID, shift_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyPaid);
        }

        let token_client = token::TokenClient::new(&env, &token);
        token_client.transfer(&employer, &worker, &amount);

        env.storage().persistent().set(&key, &true);

        ShiftPaid {
            shift_id,
            worker,
            amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Returns true if this shift ID has already been paid.
    pub fn is_paid(env: Env, shift_id: String) -> bool {
        env.storage().persistent().has(&(PAID, shift_id))
    }
}

#[cfg(test)]
mod test;
