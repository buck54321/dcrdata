package dbtypes

import (
	"fmt"
	"math"
	"time"

	"github.com/decred/dcrd/chaincfg/v2"
	"github.com/decred/dcrd/wire"
	"github.com/decred/dcrdata/txhelpers/v3"
)

// MsgBlockToDBBlock creates a dbtypes.Block from a wire.MsgBlock
func MsgBlockToDBBlock(msgBlock *wire.MsgBlock, chainParams *chaincfg.Params, chainWork string) *Block {
	// Create the dbtypes.Block structure
	blockHeader := msgBlock.Header

	// convert each transaction hash to a hex string
	txHashes := msgBlock.TxHashes()
	txHashStrs := make([]string, 0, len(txHashes))
	for i := range txHashes {
		txHashStrs = append(txHashStrs, txHashes[i].String())
	}

	stxHashes := msgBlock.STxHashes()
	stxHashStrs := make([]string, 0, len(stxHashes))
	for i := range stxHashes {
		stxHashStrs = append(stxHashStrs, stxHashes[i].String())
	}

	// Assemble the block
	return &Block{
		Hash:    blockHeader.BlockHash().String(),
		Size:    uint32(msgBlock.SerializeSize()),
		Height:  blockHeader.Height,
		Version: uint32(blockHeader.Version),
		NumTx:   uint32(len(msgBlock.Transactions) + len(msgBlock.STransactions)),
		// nil []int64 for TxDbIDs
		NumRegTx:     uint32(len(msgBlock.Transactions)),
		Tx:           txHashStrs,
		NumStakeTx:   uint32(len(msgBlock.STransactions)),
		STx:          stxHashStrs,
		Time:         NewTimeDef(blockHeader.Timestamp),
		Nonce:        uint64(blockHeader.Nonce),
		VoteBits:     blockHeader.VoteBits,
		Voters:       blockHeader.Voters,
		FreshStake:   blockHeader.FreshStake,
		Revocations:  blockHeader.Revocations,
		PoolSize:     blockHeader.PoolSize,
		Bits:         blockHeader.Bits,
		SBits:        uint64(blockHeader.SBits),
		Difficulty:   txhelpers.GetDifficultyRatio(blockHeader.Bits, chainParams),
		StakeVersion: blockHeader.StakeVersion,
		PreviousHash: blockHeader.PrevBlock.String(),
		ChainWork:    chainWork,
	}
}

// TimeBasedGroupingToInterval converts the TimeBasedGrouping value to an actual
// time value in seconds based on the gregorian calendar except AllGrouping that
// returns 1 while the unknownGrouping returns -1 and an error. Time returned is
// in seconds.
func TimeBasedGroupingToInterval(grouping TimeBasedGrouping) (float64, error) {
	now := time.Now()
	switch grouping {
	case AllGrouping:
		return 1, nil

	case DayGrouping:
		return now.AddDate(0, 0, 1).Sub(now).Seconds(), nil

	case WeekGrouping:
		return now.AddDate(0, 0, 7).Sub(now).Seconds(), nil

	case MonthGrouping:
		return now.AddDate(0, 1, 0).Sub(now).Seconds(), nil

	case YearGrouping:
		return now.AddDate(1, 0, 0).Sub(now).Seconds(), nil

	default:
		return -1, fmt.Errorf(`unknown grouping "%d"`, grouping)
	}
}

// CalculateHashRate calculates the hashrate from the difficulty value and
// the targetTimePerBlock in seconds. The hashrate returned is in form PetaHash
// per second (PH/s).
func CalculateHashRate(difficulty, targetTimePerBlock float64) float64 {
	return ((difficulty * math.Pow(2, 32)) / targetTimePerBlock) / 1000000
}

// CalculateWindowIndex calculates the window index from the quotient of a block
// height and the chainParams.StakeDiffWindowSize.
func CalculateWindowIndex(height, stakeDiffWindowSize int64) int64 {
	// A window being a group of blocks whose count is defined by
	// chainParams.StakeDiffWindowSize, the first window starts from block 1 to
	// block 144 instead of block 0 to block 143. To obtain the accurate window
	// index value, we should add 1 to the quotient obtained by dividing the block
	// height with the chainParams.StakeDiffWindowSize value; if the float precision
	// is greater than zero. The precision is equal to zero only when the block
	// height value is divisible by the window size.
	windowVal := float64(height) / float64(stakeDiffWindowSize)
	index := int64(windowVal)
	if windowVal != math.Floor(windowVal) || windowVal == 0 {
		index++
	}
	return index
}

// Factorial is a recursive function that obtains the factorial a value. 0! equals 1.
func Factorial(n float64) (res float64) {
	if n > 20 {
		return 0
	}

	if n > 0 {
		res = n * Factorial(n-1)
		return res
	}

	return 1
}
