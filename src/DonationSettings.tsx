import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { ethers, Transaction, BigNumber } from 'ethers';
import { AfterSwapDonationHook__factory, MockERC20__factory } from './contracts/index';
import { Log } from 'web3';

import {
  AfterSwapDonationHook_ADDR,
  EVENT_Donated, EVENT_DonationDisabled, EVENT_DonationEnabled, RECIPIENT1, 
  TOAST_SETTINGS, TOKEN0_ADDR, TOKEN1_ADDR, WALLET_ADDR, SWAPHELPER_ADDR
} from './Constants';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { Tooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css';

import { SwapHelper__factory } from './contracts/index';
import { hasMessageField } from 'delphirtl/sysutils';
import { useEip6963SyncProviders, EIP6963ProviderDetail, type EIP1193Provider} from 'web3-walletutils';


const DonationSettings: React.FC = () => {

  const accountRef = useRef<HTMLLabelElement>(null);

  const debug = false;
  const providers = useEip6963SyncProviders();

  const NOT_CONNECTED = "Not connected";

  const [account, setAccountAddr] = useState<string>(NOT_CONNECTED);

  const [ethAddress, setAccount] = useState<string>(WALLET_ADDR);
  const [donationAddress, setDonationAddress] = useState<string>(RECIPIENT1);
  const [donatePercent, setDonationPercent] = useState<string>('10');

  const [currency0Symbol, setCurrency0Symbol] = useState<string>('?');
  const [currency1Symbol, setCurrency1Symbol] = useState<string>('?');

  const [btnEnableDonationDisabled, set_btnEnableDonationDisabled] = useState(true);
  const [btnDisableDonationDisabled, set_btnDisableDonationDisabled] = useState(true);
  const [thisProvider, setProvider] = useState<EIP1193Provider>();
  const [web3Provider, setWeb3Provider] = useState<ethers.providers.Web3Provider>();

  const [zeroForOne, setZeroForOne] = useState(true);
  const [swapAmount, setSwapAmount] = useState<string>('0');

  const connectWallet = async () => {
    if (providers.length < 1) {
      return;
    }
    await handleConnect(providers[0]);
  }

  const testToast = () => {
    toast.success("Click here now", {
      ...TOAST_SETTINGS,
      onClick: () => {
        window.open("https://sepolia.etherscan.io/tx/0x38159fe0ec8ce7ab90ec6c455b76b5fd6a43c9c7c5b281027a36e1081b1f459f")
      }
    })
  }

  const updateCurrencySymbolDisplay = async () => {
    if ((web3Provider == undefined) || (account == NOT_CONNECTED)) {
      return;
    }
    await setupCurrencySymbols(web3Provider);
  }

  const handleSwap = async () => {

    if (providers.length < 1) {
      return;
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const Token0Contract = MockERC20__factory.connect(TOKEN0_ADDR, signer);
    const Token0Balance = await Token0Contract.balanceOf(account);

    console.log(`Account: ${account} TK0 Balance: `, ethers.utils.formatUnits(Token0Balance));

    const swapHelper = SwapHelper__factory.connect(SWAPHELPER_ADDR, signer);
    try {
      // convert swap amount to 1 unit
      const swapAmountInUnit = ethers.utils.parseUnits(swapAmount); // assuming swapAmount is in units
      const bnSwapAmount = BigNumber.from(swapAmountInUnit);
      toast.success(`Submitting swapping request of ${swapAmount} from ${currency0Symbol} to ${currency1Symbol}...`, TOAST_SETTINGS);
    } catch (error) {
      if (hasMessageField(error)) {
        console.error(error.message);
        toast.error(error.message, TOAST_SETTINGS);
      }
      throw error;
    }
  }

  useEffect(() => {
    const updateCurrency = async () => {
      try {
      } catch (error) {
        if (hasMessageField(error)) {
          console.error('Error fetching data:', error);
          toast.error(error.message, TOAST_SETTINGS);
        } else {
        }
      }
    };

    updateCurrency(); // Call the async function    

  }, [zeroForOne])

  const handleZeroForOneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let lZeroForOne = e.target.checked;
    setZeroForOne(lZeroForOne);
    // await updateCurrencySymbolDisplay(zeroForOne);
  }

  const handleGetBalance = async () => {
    if (providers.length < 1) {
      return;
    }
    if (account == '') {
      toast.error("Wallet not connect yet!", TOAST_SETTINGS)
      return;
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    try {
      const Token0Contract = MockERC20__factory.connect(TOKEN0_ADDR, signer);
      const Token0Balance = await Token0Contract.balanceOf(account);
      const Token1Contract = MockERC20__factory.connect(TOKEN1_ADDR, signer);
      const Token1Balance = await Token1Contract.balanceOf(account);
      console.log("Active account: ", account);
      console.log("TK0 Balance: ", ethers.utils.formatUnits(Token0Balance));
      console.log("TK1 Balance: ", ethers.utils.formatUnits(Token1Balance));
    } catch (error) {
      if (hasMessageField(error)) {
        console.error("144 error: ", error);
        toast.error(error.message, TOAST_SETTINGS);
      } else {
        throw error;
      }
    }
  }

  const setupProviderEvents = async (provider: ethers.providers.Web3Provider) => {
    provider.removeAllListeners();
    provider.on("error", (tx: Transaction) => {
      // Emitted when any error occurs
      console.log("transaction error: ", tx);
      toast.error("Failed to remove donation settings", TOAST_SETTINGS);
    });
    for (const topic of [EVENT_Donated, EVENT_DonationDisabled, EVENT_DonationEnabled]) {
      const filter = {
        address: AfterSwapDonationHook_ADDR,
        topics: [topic]
      }
      provider.on(filter, (log: Log) => {
        switch (log.topics![0]) {
          case EVENT_Donated: {
            const txHash = log.transactionHash;
            const abi = ["event DonatedInfo(address indexed recipient, uint256 donatedAmount, bool successfulTransfer)"];
            let iface = new ethers.utils.Interface(abi);
            const logData = iface.parseLog(log as any);
            const recipient = logData.args[0];
            const rawAmount = logData.args[1];
            const donatedAmount = ethers.utils.formatUnits(rawAmount);
            const successful = logData.args[2];
            if (successful) {
              toast.success(`Successfully donated ${donatedAmount} to ${recipient}. Click to view transaction.`,
                {
                  ...TOAST_SETTINGS,
                  onClick: () => {
                  }
                });
            } else {
              toast.error(`Failed to donate to ${recipient}`);
            }
            break;
          }
          case EVENT_DonationDisabled: {
            const txHash = log.transactionHash;
            const abi = ["event DonationDisabled(address indexed recipient, uint256 percent)"];
            let iface = new ethers.utils.Interface(abi);
            const logData = iface.parseLog(log as any);
            const recipient = logData.args[0];
            let account = accountRef.current!.textContent;
            toast.success(`Successfully disabled donation for ${account} to ${recipient}. Click to view transaction.`,
              {
                ...TOAST_SETTINGS,
                onClick: () => {
                }
              });
            break;
          }
          case EVENT_DonationEnabled: {
            const txHash = log.transactionHash;
            const abi = ["event DonationEnabled(address indexed recipient, uint256 percent)"];
            let iface = new ethers.utils.Interface(abi);
            const logData = iface.parseLog(log as any);
            const recipient = logData.args[0];
            const donatePercent = logData.args[1];
            let account = accountRef.current!.textContent;
            toast.success(`Successfully enabled donation for ${account} to ${recipient} of ${donatePercent}%!. Click to view transaction.`,
              {
                ...TOAST_SETTINGS,
                onClick: () => {
                }
              });
            break;
          }
          default: {
            toast.error("Unhandled event!", TOAST_SETTINGS);
            break;
          }
        } // end switch
      })
    }
  }

  const accountsChanged =
    useCallback((accounts: Array<string>) => {
      if (accounts.length == 0) {
        setAccountAddr(NOT_CONNECTED);
        return;
      }
      const activeAccount = accounts[0];
      setAccountAddr(activeAccount);
      try {
        toast.success(`Active account changed to: ${activeAccount}`, TOAST_SETTINGS);
      } catch (error) {
        if (hasMessageField(error)) {
          console.log("Unknown error: ", error.message);
          toast.error(error.message, TOAST_SETTINGS);
        } else {
          throw error;
        }
      }
    }, [account])

  // const beforeUnloadHandler = (event: any) => {
  //   event.preventDefault();

  //   const provider = web3Provider;

  //   // Included for legacy support, e.g. Chrome/Edge < 119
  //   event.returnValue = true;
  //   if (!provider) {
  //     return;
  //   }
  //   provider.removeListener("accountsChanged", accountsChanged);
  // };

  const setupCurrencySymbols = async (provider: ethers.providers.Web3Provider) => {
    const Token0Contract = MockERC20__factory.connect(TOKEN0_ADDR, provider);
    const Token1Contract = MockERC20__factory.connect(TOKEN1_ADDR, provider);
    const symbol0 = await Token0Contract.symbol();
    const symbol1 = await Token1Contract.symbol();
    let token0, token1;
    if (zeroForOne) {
      token0 = symbol0;
      token1 = symbol1;
    } else {
      token0 = symbol1;
      token1 = symbol0;
    }
    setCurrency0Symbol(token0);
    setCurrency1Symbol(token1);
  }

  async function handleConnect(providerWithInfo: EIP6963ProviderDetail) {
    try {
      setProvider(providerWithInfo.provider);
      // providerInfo.setProvider(providerWithInfo);
      const lProvider = providerWithInfo.provider;
      console.log("thisProvider: ", lProvider);
      const accounts = (await providerWithInfo.provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length > 0) {
        setAccountAddr(accounts[0]);
        const provider = new ethers.providers.Web3Provider(window.ethereum);

        // window.onbeforeunload = beforeUnloadHandler;

        window.ethereum.removeAllListeners();
        window.ethereum.removeListener("accountsChanged", accountsChanged);
        setWeb3Provider(provider);
        setupProviderEvents(provider);
        await setupCurrencySymbols(provider);
        window.ethereum.on("accountsChanged", accountsChanged);

        console.log("130 provider: ", provider);
      } else {
        setAccountAddr("Not connected");
        toast.success("All accounts disconnected", TOAST_SETTINGS);
      }
      const disabledButtons = accounts.length == 0;
      set_btnEnableDonationDisabled(disabledButtons);
      set_btnDisableDonationDisabled(disabledButtons);
      console.log("accounts: ", accounts);
    } catch (error) {
      if (hasMessageField(error)) {
        console.error("309 error: ", error.message);
        toast.error(error.message, TOAST_SETTINGS);
      }
    }
  }

  const handleDisableDonation = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const donationHookContract = AfterSwapDonationHook__factory.connect(AfterSwapDonationHook_ADDR, signer);
      const currentDonationEnabledProperty = donationHookContract['donationEnabled()'];
      const currentDonationEnabled = await currentDonationEnabledProperty();
      if (currentDonationEnabled) {
        const receipt1 = await donationHookContract.disableDonation();
        toast.success("Submitted disable donation request to blockchain", TOAST_SETTINGS);

        const Token0Contract = MockERC20__factory.connect(TOKEN0_ADDR, signer);
        // withdraw approval
        const receipt2 = await Token0Contract.approve(AfterSwapDonationHook_ADDR, 0);      
        toast.success("Submitted removal of approval for token!", TOAST_SETTINGS);

      } else {
        toast.error("Donation is not currently enabled.", TOAST_SETTINGS);
      }
    } catch (error) {
      // rejected by user or failed on the network
      if (hasMessageField(error)) {
        console.error("143 error: ", error.message);
        toast.error(error.message, TOAST_SETTINGS);
      }
    }
  }

  const handleEnableDonation = async () => {
    if (!donationAddress) {
      toast.error('Please enter donation address', TOAST_SETTINGS);
      return;
    }
    if (donationAddress.toLowerCase() == account.toLowerCase()) {
      toast.error('Donation recipient cannot be same as wallet! You cannot donate to yourself!', TOAST_SETTINGS);
      return;
    }
    if (Number.isNaN(donatePercent)) {
      toast.error("Donation percent needs to be a number", TOAST_SETTINGS);
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    try {
      const token0 = MockERC20__factory.connect(TOKEN0_ADDR, signer);
      const UINT256_MAX = BigNumber.from(2).pow(256).sub(1); // (2^256)-1
      const allowedAmount = await token0.allowance(account, AfterSwapDonationHook_ADDR);
      if (allowedAmount.eq(BigNumber.from(0))) {
        await token0.approve(AfterSwapDonationHook_ADDR, UINT256_MAX);
        toast.success(`Submitted "Approve token spending on behalf of wallet to hook" to blockchain`, TOAST_SETTINGS);
      }
    } catch (error) {
      if (hasMessageField(error)) {
        console.error("215 error: ", error.message);
        toast.error(`Failed to submit request: ${error.message}`, TOAST_SETTINGS);
      }
    }

    try {

      const donationHookContract = AfterSwapDonationHook__factory.connect(AfterSwapDonationHook_ADDR, signer);

      const address = ethers.utils.hexZeroPad(donationAddress, 20);
      const currentRecipientProperty = donationHookContract['donationRecipient()'];
      const currentRecipient = await currentRecipientProperty();

      const currentDonationEnabledProperty = donationHookContract['donationEnabled()'];
      const currentDonationEnabled = await currentDonationEnabledProperty();

      const currentDonationPercentProperty = donationHookContract['donationPercent()'];
      const currentDonationPercent = await currentDonationPercentProperty();

      const recipient = address;
      if ((!currentDonationEnabled) || (!currentDonationPercent.eq(BigNumber.from(donatePercent))) ||
        currentRecipient.toLowerCase() != recipient.toLowerCase()
      ) {
        toast.success(`Submitted enable donation request for ${account} to ${recipient} of ${donatePercent}% to blockchain`, TOAST_SETTINGS);
      } else {
        toast.error(`Donation already enabled for ${account} to ${recipient} of ${donatePercent}%!`, TOAST_SETTINGS);
      }

    } catch (error) {
      if (hasMessageField(error)) {
        console.error("398 error: ", error.message)
        toast.error(`Error encountered: ${error.message}`, TOAST_SETTINGS);
      }
    }

  }


  return (

    <div className="App">
      <h2>Donation Settings:</h2>
      <div className="providers">
        {providers.length > 0 ? (

          <>

            <div className="container">
              <div className="content">
                <label>Active Wallet: </label><label ref={accountRef}>{account}</label><br />
                <Tooltip id="my-tooltip" />
                &nbsp;&nbsp;
                <label>Donation recipient: </label>
                <input
                  data-tooltip-id="my-tooltip" data-tooltip-content="Set the donation recipient address here"
                  type="text"
                  placeholder="Donation recipient address"
                  value={donationAddress}
                  onChange={(e) => setDonationAddress(e.target.value)}
                  size={44}
                />
                <br />
                <label>Donation percent: </label>
                <input
                  data-tooltip-id="my-tooltip" data-tooltip-content="Set the percent to donate here"
                  type="text"
                  placeholder="Percent of transaction to donate"
                  value={donatePercent}
                  onChange={(e) => setDonationPercent(e.target.value)}
                  size={1}
                />
                <br /><br />
                <button onClick={connectWallet} >Connect to wallet</button>
                &nbsp;&nbsp;
                <button onClick={handleEnableDonation} disabled={btnEnableDonationDisabled}>Enable donation</button>
                &nbsp;&nbsp;
                <button onClick={handleDisableDonation} disabled={btnDisableDonationDisabled}>Disable donation</button>
                <br /><br />
                <br /><br />

                <div>
                  <div>
                    <div className="content">
                      <label>
                        <input type="checkbox" checked={zeroForOne} onChange={
                          async e =>
                            await handleZeroForOneChange(e)
                        } />Zero For One
                      </label>
                      <br />
                      Swap
                      <Tooltip id="my-tooltip" />
                      &nbsp;&nbsp;
                      <input
                        data-tooltip-id="my-tooltip" data-tooltip-content="Amount to swap"
                        type="text"
                        placeholder="Amount to swap"
                        value={swapAmount}
                        onChange={(e) =>
                          setSwapAmount(e.target.value)
                        }
                        size={5}  // Dynamically set size based on input length
                      />
                      &nbsp;&nbsp;<label>{currency0Symbol}</label> &nbsp;&nbsp; to &nbsp;&nbsp; <label>{currency1Symbol}</label>
                      &nbsp;&nbsp;
                      <br /><br />
                      <button onClick={handleSwap} >Swap tokens</button>
                      <br />
                    </div>
                  </div>
                  <ToastContainer />

                </div>


                {debug ?
                  (
                    <>
                      <br /><br />
                      <button onClick={handleGetBalance} >Get balances</button>
                      <br />
                      <button onClick={testToast}>Test Toast</button>
                    </>
                  ) : (
                    <>
                    </>
                  )
                }
              </div>
            </div>

          </>
        ) : (
          <div>No Announced Wallet Providers</div>
        )}
      </div>
    </div>
  );
};

export default DonationSettings 
