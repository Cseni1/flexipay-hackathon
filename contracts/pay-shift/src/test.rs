#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = sac.address();

    let client = token::StellarAssetClient::new(&env, &token);
    client.mint(&employer, &10_000_0000);

    let contract_id = env.register(PayShift, ());
    (env, contract_id, employer, worker, token)
}

#[test]
fn pays_once_and_rejects_duplicate() {
    let (env, contract_id, employer, worker, token) = setup();
    let client = PayShiftClient::new(&env, &contract_id);
    let shift_id = String::from_str(&env, "FW-120926-001");
    let amount: i128 = 1_000_0000;

    client.pay_shift(&shift_id, &employer, &worker, &token, &amount);
    assert!(client.is_paid(&shift_id));

    let worker_bal = token::TokenClient::new(&env, &token).balance(&worker);
    assert_eq!(worker_bal, amount);

    let result = client.try_pay_shift(&shift_id, &employer, &worker, &token, &amount);
    assert_eq!(result, Err(Ok(Error::AlreadyPaid)));
}
