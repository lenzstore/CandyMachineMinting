import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar, AppBar, Toolbar, Typography, Grid, ButtonBase } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton, WalletDisconnectButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";

const ConnectButton = styled(WalletDialogButton)`background-color: #81AD27;
  color: #81AD27 !important;
  font-size: 14px;
  border-radius: 50px;
  cursor: pointer;
  text-transform: none !important;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FFEA 100%);
  box-shadow: 15px 25px 34.14634323120117px 0px #A679231A;`;
const ConnectedButton = styled(Button)`background-color: #81AD27;
  color: #81AD27 !important;
  font-size: 14px;
  border-radius: 50px;
  cursor: pointer;
  text-transform: none !important;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FFEA 100%);
  box-shadow: 15px 25px 34.14634323120117px 0px #A679231A;
  padding: 10px;`;
const DisConnectButton = styled(WalletDisconnectButton)`background-color: #81AD27;
  color: #81AD27 !important;
  font-size: 14px;
  border-radius: 50px;
  cursor: pointer;
  text-transform: none !important;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FFEA 100%);
  margin-left: 10px;
  box-shadow: 15px 25px 34.14634323120117px 0px #A679231A;`;

const CounterText = styled.h1``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)`background-color: #81AD27;
  color: white;
  font-size: 14px;
  border-radius: 84px;
  text-transform: none !important;
  min-width: 200px;
  cursor: pointer;`; // add your styles here

export interface HomeProps {  
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [itemsAvailable, setItemsAvailable] = useState<number>();
  const [itemsRedeemed, setItemsRedeemed] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
  const [isConnected, setIsConnected] = useState(true); // true when user got to press MINT

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  
  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet?.publicKey) {
        const balance = await props.connection.getBalance(wallet?.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet?.publicKey) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(() => {
    (async () => {      
      if (
        !wallet ||
        !wallet.publicKey ||
        !wallet.signAllTransactions ||
        !wallet.signTransaction
      ) {        
        // setAlertState({
        //   open: true,
        //   message: "Please install Phantom wallet",
        //   severity: "error",
        // });
        // console.log('Phantom Extension is not installed!');
        return;
      }

      const anchorWallet = {
        publicKey: wallet.publicKey,
        signAllTransactions: wallet.signAllTransactions,
        signTransaction: wallet.signTransaction,
      } as anchor.Wallet;

      const { candyMachine, goLiveDate, itemsRemaining, itemsAvailable, itemsRedeemed} =
        await getCandyMachineState(
          anchorWallet,
          props.candyMachineId,
          props.connection
        );

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
      setItemsAvailable(itemsAvailable);
      setItemsRedeemed(itemsRedeemed);
    })();
  }, [wallet, props.candyMachineId, props.connection]);
  
  return (
    <main>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" style={{ flex: 1 }}>
          PerkyPanda Club
          </Typography>
          {!wallet.connected ? (
            <ConnectButton>Connect Wallet</ConnectButton>
          ) : 
          (
            <div>
            <ConnectedButton>Address: {shortenAddress(wallet.publicKey?.toBase58() || "")}</ConnectedButton>
            <DisConnectButton></DisConnectButton>
            </div>
            
          )}          
        </Toolbar>
      </AppBar>
      

      {/* {wallet.connected && (
        <p>Balance: {(balance || 0).toLocaleString()} SOL</p>
      )} */}

        <Grid container spacing={1} justifyContent="center" alignItems="center" style={{ marginTop: "100px" }}>
          <Grid container item xs={12} justifyContent="center" alignItems="center">
            <ButtonBase style={{ width: 128, height: 128 }}>
              <img style={{ margin: 'auto',display: 'block',maxWidth: '100%',maxHeight: '100%', }} alt="complex" src="logo192.png" />
            </ButtonBase>
          </Grid>
          <Grid container item xs={12} justifyContent="center" alignItems="center">
            <Typography variant="h5" style={{ color: "white" }}>Buy A Panda</Typography>            
          </Grid>
          <Grid container item xs={12} justifyContent="center" alignItems="center">
            <Typography variant="h6" style={{ color: "white" }}>Join Perky Panda Club by buying a panda at just 3 sol</Typography>
          </Grid>   
          {!wallet.connected ? (         
            <div></div>): (
          <Grid container item xs={12} justifyContent="center" alignItems="center">
          <Typography variant="h6" style={{ color: "white" }}>{itemsRedeemed} / {itemsAvailable}</Typography>
          </Grid>          
          )}
          <Grid container item xs={12} justifyContent="center" alignItems="center">
          {!wallet.connected ? (            
            <ConnectButton>Connect Wallet</ConnectButton>
          ) : 
          (
          <MintContainer>          
          <MintButton
            disabled={isSoldOut || isMinting || !isActive}
            onClick={onMint}
            variant="contained"            
          >             
            {isSoldOut ? (
              "SOLD OUT"
            ) : isActive ? (
              isMinting ? (
                <CircularProgress />
              ) : (
                "Mint now"
              )
            )
             : (
              <div>
                <MintButton disabled={isActive}>Minting coming soon</MintButton>
                <br/>
                <Countdown
                  date={Date.now()+10000}
                  onMount={({ completed }) => completed && setIsActive(true)}
                  onComplete={() => setIsActive(true)}
                  renderer={renderCounter}
                />                
              </div>
            )}
          </MintButton>
          </MintContainer>
          )}
        </Grid>
      </Grid>

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {days}:{hours}:{minutes}:{seconds}
    </CounterText>
  );
};

export default Home;
