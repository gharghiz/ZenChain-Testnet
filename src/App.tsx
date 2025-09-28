import React, { useState, useEffect } from 'react';
import { Twitter, MessageCircle, ArrowUpDown, Wallet, ExternalLink, Plus, AlertCircle, CheckCircle, Loader } from 'lucide-react';

// Types
interface Token {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  icon: string;
}

interface SwapState {
  fromToken: Token | null;
  toToken: Token | null;
  fromAmount: string;
  toAmount: string;
  slippage: number;
}

interface WalletState {
  connected: boolean;
  address: string;
  balance: string;
  chainId: number | null;
}

// Token list
const TOKENS: Token[] = [
  {
    symbol: 'ZTC',
    name: 'ZenChain Token',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000',
    icon: '🟣'
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    address: '0x1234567890123456789012345678901234567890',
    icon: '₿'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: '0x2345678901234567890123456789012345678901',
    icon: 'Ξ'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0x3456789012345678901234567890123456789012',
    icon: '₮'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0x4567890123456789012345678901234567890123',
    icon: '🔵'
  },
  {
    symbol: 'POL',
    name: 'Polygon',
    decimals: 18,
    address: '0x5678901234567890123456789012345678901234',
    icon: '🟠'
  }
];

const ZENCHAIN_CONFIG = {
  chainId: '0x20D8', // 8408 in hex
  chainName: 'ZenChain Testnet',
  nativeCurrency: {
    name: 'ZTC',
    symbol: 'ZTC',
    decimals: 18,
  },
  rpcUrls: ['https://zenchain-testnet.api.onfinality.io/public'],
  blockExplorerUrls: ['https://zentrace.io'],
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: '',
    balance: '0',
    chainId: null
  });

  const [swap, setSwap] = useState<SwapState>({
    fromToken: TOKENS[0], // ZTC by default
    toToken: null,
    fromAmount: '',
    toAmount: '',
    slippage: 0.5
  });

  const [balances, setBalances] = useState<{ [key: string]: string }>({});
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenModalType, setTokenModalType] = useState<'from' | 'to'>('from');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  // Check if wallet is already connected
  useEffect(() => {
    checkWalletConnection();
  }, []);

  // Update balances when wallet connects
  useEffect(() => {
    if (wallet.connected) {
      updateBalances();
    }
  }, [wallet.connected, wallet.address]);

  // Calculate exchange rate and to amount
  useEffect(() => {
    if (swap.fromAmount && swap.fromToken && swap.toToken) {
      // Simple mock exchange rate calculation (1:1 for demo)
      const rate = swap.fromToken.symbol === 'ZTC' ? 1 : 0.95;
      const toAmount = (parseFloat(swap.fromAmount) * rate).toFixed(6);
      setSwap(prev => ({ ...prev, toAmount }));
    } else {
      setSwap(prev => ({ ...prev, toAmount: '' }));
    }
  }, [swap.fromAmount, swap.fromToken, swap.toToken]);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const balance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [accounts[0], 'latest']
          });
          
          setWallet({
            connected: true,
            address: accounts[0],
            balance: (parseInt(balance, 16) / 1e18).toFixed(4),
            chainId: parseInt(chainId, 16)
          });
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or Rabby Wallet to connect');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Connecting wallet...');

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Check if we're on ZenChain Testnet
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== ZENCHAIN_CONFIG.chainId) {
        setStatus('Adding ZenChain Testnet...');
        
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ZENCHAIN_CONFIG.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [ZENCHAIN_CONFIG],
            });
          } else {
            throw switchError;
          }
        }
      }

      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [accounts[0], 'latest']
      });

      setWallet({
        connected: true,
        address: accounts[0],
        balance: (parseInt(balance, 16) / 1e18).toFixed(4),
        chainId: parseInt(chainId, 16)
      });

      setStatus('Wallet connected successfully!');
      setTimeout(() => setStatus(''), 3000);

    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setStatus(`Connection failed: ${error.message}`);
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBalances = async () => {
    if (!wallet.connected) return;

    const newBalances: { [key: string]: string } = {};
    
    for (const token of TOKENS) {
      try {
        if (token.symbol === 'ZTC') {
          // Native token balance
          const balance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [wallet.address, 'latest']
          });
          newBalances[token.symbol] = (parseInt(balance, 16) / 1e18).toFixed(4);
        } else {
          // Mock balances for other tokens
          newBalances[token.symbol] = (Math.random() * 1000).toFixed(4);
        }
      } catch (error) {
        newBalances[token.symbol] = '0';
      }
    }
    
    setBalances(newBalances);
  };

  const addTokenToWallet = async (token: Token) => {
    if (!wallet.connected || token.symbol === 'ZTC') return;

    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            image: `https://via.placeholder.com/32x32/6366F1/FFFFFF?text=${token.symbol[0]}`,
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to wallet:', error);
    }
  };

  const handleSwapDirectionChange = () => {
    setSwap(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      fromAmount: prev.toAmount,
      toAmount: prev.fromAmount
    }));
  };

  const openTokenModal = (type: 'from' | 'to') => {
    setTokenModalType(type);
    setShowTokenModal(true);
  };

  const selectToken = (token: Token) => {
    if (tokenModalType === 'from') {
      setSwap(prev => ({ ...prev, fromToken: token }));
    } else {
      setSwap(prev => ({ ...prev, toToken: token }));
    }
    setShowTokenModal(false);
  };

  const executeSwap = async () => {
    if (!wallet.connected || !swap.fromToken || !swap.toToken || !swap.fromAmount) {
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Preparing swap transaction...');

      // Mock transaction hash for demo
      const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      
      setStatus('Transaction submitted! Waiting for confirmation...');
      setTxHash(mockTxHash);

      // Simulate transaction confirmation
      setTimeout(() => {
        setStatus('Swap completed successfully!');
        updateBalances(); // Refresh balances
        setTimeout(() => {
          setStatus('');
          setTxHash('');
        }, 5000);
      }, 3000);

    } catch (error: any) {
      console.error('Swap error:', error);
      setStatus(`Swap failed: ${error.message}`);
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const canSwap = wallet.connected && swap.fromToken && swap.toToken && swap.fromAmount && parseFloat(swap.fromAmount) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/main.jpg" 
                alt="ZenChain" 
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">ZenChain DEX</h1>
                <p className="text-sm text-white/70">Decentralized Exchange</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <a
                href="https://twitter.com/zenchain"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Twitter className="w-5 h-5 text-white" />
              </a>
              <a
                href="https://discord.gg/zenchain"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto pt-8 px-4">
        {/* Wallet Connection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          {!wallet.connected ? (
            <button
              onClick={connectWallet}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Wallet className="w-5 h-5" />
              )}
              <span>{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Connected</span>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div className="text-white font-mono text-sm">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </div>
              <div className="text-white font-semibold">
                {wallet.balance} ZTC
              </div>
            </div>
          )}
        </div>

        {/* Swap Interface */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-6">Swap Tokens</h2>
          
          {/* From Token */}
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/70 text-sm">From</span>
                {swap.fromToken && balances[swap.fromToken.symbol] && (
                  <span className="text-white/70 text-sm">
                    Balance: {balances[swap.fromToken.symbol]}
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => openTokenModal('from')}
                  className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="text-lg">{swap.fromToken?.icon || '?'}</span>
                  <span className="text-white font-semibold">{swap.fromToken?.symbol || 'Select'}</span>
                </button>
                
                <input
                  type="number"
                  placeholder="0.0"
                  value={swap.fromAmount}
                  onChange={(e) => setSwap(prev => ({ ...prev, fromAmount: e.target.value }))}
                  className="flex-1 bg-transparent text-white text-xl placeholder-white/50 outline-none"
                />
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <button
                onClick={handleSwapDirectionChange}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 hover:rotate-180"
              >
                <ArrowUpDown className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* To Token */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/70 text-sm">To</span>
                {swap.toToken && balances[swap.toToken.symbol] && (
                  <span className="text-white/70 text-sm">
                    Balance: {balances[swap.toToken.symbol]}
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => openTokenModal('to')}
                  className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="text-lg">{swap.toToken?.icon || '?'}</span>
                  <span className="text-white font-semibold">{swap.toToken?.symbol || 'Select'}</span>
                </button>
                
                <input
                  type="number"
                  placeholder="0.0"
                  value={swap.toAmount}
                  readOnly
                  className="flex-1 bg-transparent text-white text-xl placeholder-white/50 outline-none"
                />
              </div>
            </div>

            {/* Swap Details */}
            {swap.fromToken && swap.toToken && swap.fromAmount && (
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Exchange Rate</span>
                  <span className="text-white">1 {swap.fromToken.symbol} ≈ 0.95 {swap.toToken.symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Price Impact</span>
                  <span className="text-green-400">{'<0.01%'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Slippage Tolerance</span>
                  <span className="text-white">{swap.slippage}%</span>
                </div>
              </div>
            )}

            {/* Swap Button */}
            <button
              onClick={executeSwap}
              disabled={!canSwap || isLoading}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
                canSwap && !isLoading
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                  : 'bg-white/10 text-white/50 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : !wallet.connected ? (
                'Connect Wallet'
              ) : !swap.fromToken || !swap.toToken ? (
                'Select Tokens'
              ) : !swap.fromAmount ? (
                'Enter Amount'
              ) : (
                `Swap ${swap.fromToken.symbol} for ${swap.toToken.symbol}`
              )}
            </button>
          </div>
        </div>

        {/* Status Display */}
        {status && (
          <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <Loader className="w-5 h-5 text-blue-400 animate-spin" />
              ) : status.includes('successfully') ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : status.includes('failed') || status.includes('Error') ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              )}
              <span className="text-white text-sm">{status}</span>
            </div>
            
            {txHash && (
              <div className="mt-2">
                <a
                  href={`https://zentrace.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <span>View Transaction</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Token Selection Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-md border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">Select Token</h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => selectToken(token)}
                  className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{token.icon}</span>
                    <div className="text-left">
                      <div className="text-white font-semibold">{token.symbol}</div>
                      <div className="text-white/70 text-sm">{token.name}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {balances[token.symbol] && (
                      <span className="text-white/70 text-sm">{balances[token.symbol]}</span>
                    )}
                    {wallet.connected && token.symbol !== 'ZTC' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addTokenToWallet(token);
                        }}
                        className="p-1 bg-white/10 hover:bg-white/20 rounded"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowTokenModal(false)}
              className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;