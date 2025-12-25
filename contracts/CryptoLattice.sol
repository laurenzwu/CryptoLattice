// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, euint256, externalEaddress, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title CryptoLattice
/// @notice Non-transferable NFT carrying a 3x3 encrypted board with per-slot ACLs.
contract CryptoLattice is ZamaEthereumConfig {
    string public constant name = "CryptoLattice";
    string public constant symbol = "CLT";
    uint8 public constant GRID_SIZE = 9;

    struct Cell {
        euint256 numericValue;
        eaddress addressValue;
        bool isAddress;
        bool initialized;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _ownedToken;
    mapping(uint256 => Cell[GRID_SIZE]) private _cells;
    mapping(uint256 => mapping(uint8 => address[])) private _cellPermissions;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) private _permissionLookup;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event BoardMinted(address indexed owner, uint256 indexed tokenId);
    event CellUpdated(uint256 indexed tokenId, uint8 indexed position, bool isAddress);
    event AccessGranted(uint256 indexed tokenId, uint8 indexed position, address indexed grantee);

    error InvalidPosition();
    error NotTokenOwner();
    error SlotNotInitialized();
    error AlreadyMinted();
    error TransfersDisabled();
    error InvalidAddress();
    error TokenDoesNotExist();

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function balanceOf(address owner) public view returns (uint256) {
        if (owner == address(0)) {
            revert InvalidAddress();
        }
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        if (owner == address(0)) {
            revert TokenDoesNotExist();
        }
        return owner;
    }

    function tokenOf(address user) external view returns (uint256) {
        return _ownedToken[user];
    }

    function tokenExists(uint256 tokenId) public view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function mintBoard() external returns (uint256) {
        if (_ownedToken[msg.sender] != 0) {
            revert AlreadyMinted();
        }

        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] += 1;
        _ownedToken[msg.sender] = tokenId;

        emit Transfer(address(0), msg.sender, tokenId);
        emit BoardMinted(msg.sender, tokenId);

        return tokenId;
    }

    function setNumber(uint8 position, externalEuint256 encryptedValue, bytes calldata inputProof) external {
        uint256 tokenId = _ownedToken[msg.sender];
        if (tokenId == 0) {
            revert NotTokenOwner();
        }
        _validatePosition(position);

        Cell storage cell = _cells[tokenId][position];
        cell.numericValue = FHE.fromExternal(encryptedValue, inputProof);
        cell.isAddress = false;
        cell.initialized = true;

        _enrichAccess(cell, tokenId, position);
        emit CellUpdated(tokenId, position, false);
    }

    function setAddress(uint8 position, externalEaddress encryptedValue, bytes calldata inputProof) external {
        uint256 tokenId = _ownedToken[msg.sender];
        if (tokenId == 0) {
            revert NotTokenOwner();
        }
        _validatePosition(position);

        Cell storage cell = _cells[tokenId][position];
        cell.addressValue = FHE.fromExternal(encryptedValue, inputProof);
        cell.isAddress = true;
        cell.initialized = true;

        _enrichAccess(cell, tokenId, position);
        emit CellUpdated(tokenId, position, true);
    }

    function grantAccess(uint8 position, address grantee) external {
        uint256 tokenId = _ownedToken[msg.sender];
        if (tokenId == 0) {
            revert NotTokenOwner();
        }
        if (grantee == address(0)) {
            revert InvalidAddress();
        }
        _validatePosition(position);

        Cell storage cell = _cells[tokenId][position];
        if (!cell.initialized) {
            revert SlotNotInitialized();
        }

        if (!_permissionLookup[tokenId][position][grantee]) {
            _permissionLookup[tokenId][position][grantee] = true;
            _cellPermissions[tokenId][position].push(grantee);
        }

        _grantCiphertext(cell, grantee);
        emit AccessGranted(tokenId, position, grantee);
    }

    function getCell(
        uint256 tokenId,
        uint8 position
    )
        external
        view
        returns (euint256 numericValue, eaddress addressValue, bool isAddressSlot, bool initialized)
    {
        if (!tokenExists(tokenId)) {
            revert TokenDoesNotExist();
        }
        _validatePosition(position);

        Cell storage cell = _cells[tokenId][position];
        return (cell.numericValue, cell.addressValue, cell.isAddress, cell.initialized);
    }

    function getBoard(
        uint256 tokenId
    )
        external
        view
        returns (
            euint256[GRID_SIZE] memory numericValues,
            eaddress[GRID_SIZE] memory addressValues,
            bool[GRID_SIZE] memory isAddressSlot,
            bool[GRID_SIZE] memory initialized
        )
    {
        if (!tokenExists(tokenId)) {
            revert TokenDoesNotExist();
        }

        for (uint8 i = 0; i < GRID_SIZE; i++) {
            Cell storage cell = _cells[tokenId][i];
            numericValues[i] = cell.numericValue;
            addressValues[i] = cell.addressValue;
            isAddressSlot[i] = cell.isAddress;
            initialized[i] = cell.initialized;
        }
    }

    function getAllowedAddresses(uint256 tokenId, uint8 position) external view returns (address[] memory) {
        if (!tokenExists(tokenId)) {
            revert TokenDoesNotExist();
        }
        _validatePosition(position);
        return _cellPermissions[tokenId][position];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (!tokenExists(tokenId)) {
            revert TokenDoesNotExist();
        }
        return "";
    }

    function approve(address, uint256) external pure {
        revert TransfersDisabled();
    }

    function setApprovalForAll(address, bool) external pure {
        revert TransfersDisabled();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure {
        revert TransfersDisabled();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert TransfersDisabled();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert TransfersDisabled();
    }

    function _enrichAccess(Cell storage cell, uint256 tokenId, uint8 position) private {
        address owner = _owners[tokenId];
        if (cell.isAddress) {
            FHE.allowThis(cell.addressValue);
            _grantCiphertext(cell, owner);
        } else {
            FHE.allowThis(cell.numericValue);
            _grantCiphertext(cell, owner);
        }

        address[] storage allowed = _cellPermissions[tokenId][position];
        uint256 length = allowed.length;
        for (uint256 i = 0; i < length; i++) {
            _grantCiphertext(cell, allowed[i]);
        }
    }

    function _grantCiphertext(Cell storage cell, address grantee) private {
        if (cell.isAddress) {
            FHE.allow(cell.addressValue, grantee);
        } else {
            FHE.allow(cell.numericValue, grantee);
        }
    }

    function _validatePosition(uint8 position) private pure {
        if (position >= GRID_SIZE) {
            revert InvalidPosition();
        }
    }
}
