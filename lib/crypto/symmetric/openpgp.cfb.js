const misc = require('util/misc');
const logger = require("util/logger").create('openpgp.cfb.js');

//(blockcipherencryptfn, block_size, key, ciphertext, iv) {

// Modified by Recurity Labs GmbH 

// modified version of http://www.hanewin.net/encrypt/PGdecode.js:

/* OpenPGP encryption using RSA/AES
 * Copyright 2005-2006 Herbert Hanewinkel, www.haneWIN.de
 * version 2.0, check www.haneWIN.de for the latest version

 * This software is provided as-is, without express or implied warranty.  
 * Permission to use, copy, modify, distribute or sell this software, with or
 * without fee, for any purpose and by any individual or organization, is hereby
 * granted, provided that the above copyright notice and this paragraph appear 
 * in all copies. Distribution as a part of an application or binary must
 * include the above copyright notice in the documentation and/or other
 * materials provided with the application or distribution.
 */

// --------------------------------------
/**
 * This function encrypts a given with the specified prefixrandom 
 * using the specified blockcipher to encrypt a message
 * @param prefixrandom random bytes of block_size length provided 
 *  as a string to be used in prefixing the data
 * @param blockcipherfn the algorithm encrypt function to encrypt
 *  data in one block_size encryption. The function must be 
 *  specified as blockcipherfn([integer_array(integers 0..255)] 
 *  block,[integer_array(integers 0..255)] key) returning an 
 *  array of bytes (integers 0..255)
 * @param block_size the block size in bytes of the algorithm used
 * @param plaintext data to be encrypted provided as a string
 * @param key key to be used to encrypt the data as 
 *  integer_array(integers 0..255)]. This will be passed to the 
 *  blockcipherfn
 * @param resync a boolean value specifying if a resync of the 
 *  IV should be used or not. The encrypteddatapacket uses the 
 *  "old" style with a resync. Encryption within an 
 *  encryptedintegrityprotecteddata packet is not resyncing the IV.
 * @return a string with the encrypted data
 */
function openpgp_cfb_encrypt(prefixrandom, blockcipherencryptfn, plaintext, block_size, key, resync) {
	var FR = new Array(block_size);
	var FRE = new Array(block_size);

	prefixrandom = prefixrandom + prefixrandom.charAt(block_size-2) +prefixrandom.charAt(block_size-1);
	logger.debug("prefixrandom:"+misc.hexstrdump(prefixrandom));
	var ciphertext = "";
	// 1.  The feedback register (FR) is set to the IV, which is all zeros.
	for (var i = 0; i < block_size; i++) FR[i] = 0;
	
	// 2.  FR is encrypted to produce FRE (FR Encrypted).  This is the
    //     encryption of an all-zero value.
	FRE = blockcipherencryptfn(FR, key);
	// 3.  FRE is xored with the first BS octets of random data prefixed to
    //     the plaintext to produce C[1] through C[BS], the first BS octets
    //     of ciphertext.
	for (var i = 0; i < block_size; i++) ciphertext += String.fromCharCode(FRE[i] ^ prefixrandom.charCodeAt(i));
	
	// 4.  FR is loaded with C[1] through C[BS].
	for (var i = 0; i < block_size; i++) FR[i] = ciphertext.charCodeAt(i);
	
	// 5.  FR is encrypted to produce FRE, the encryption of the first BS
    // 	   octets of ciphertext.
	FRE = blockcipherencryptfn(FR, key);

	// 6.  The left two octets of FRE get xored with the next two octets of
	//     data that were prefixed to the plaintext.  This produces C[BS+1]
	//     and C[BS+2], the next two octets of ciphertext.
	ciphertext += String.fromCharCode(FRE[0] ^ prefixrandom.charCodeAt(block_size));
	ciphertext += String.fromCharCode(FRE[1] ^ prefixrandom.charCodeAt(block_size+1));

	if (resync) {
		// 7.  (The resync step) FR is loaded with C3-C10.
		for (var i = 0; i < block_size; i++) FR[i] = ciphertext.charCodeAt(i+2);
	} else {
		for (var i = 0; i < block_size; i++) FR[i] = ciphertext.charCodeAt(i);
	}
	// 8.  FR is encrypted to produce FRE.
	FRE = blockcipherencryptfn(FR, key);
	
	if (resync) {
		// 9.  FRE is xored with the first 8 octets of the given plaintext, now
	    //	   that we have finished encrypting the 10 octets of prefixed data.
	    // 	   This produces C11-C18, the next 8 octets of ciphertext.
		for (var i = 0; i < block_size; i++)
			ciphertext += String.fromCharCode(FRE[i] ^ plaintext.charCodeAt(i));
		for(n=block_size+2; n < plaintext.length; n+=block_size) {
			// 10. FR is loaded with C11-C18
			for (var i = 0; i < block_size; i++) FR[i] = ciphertext.charCodeAt(n+i);
		
			// 11. FR is encrypted to produce FRE.
			FRE = blockcipherencryptfn(FR, key);
		
			// 12. FRE is xored with the next 8 octets of plaintext, to produce the
			// next 8 octets of ciphertext.  These are loaded into FR and the
			// process is repeated until the plaintext is used up.
			for (var i = 0; i < block_size; i++) ciphertext += String.fromCharCode(FRE[i] ^ plaintext.charCodeAt((n-2)+i));
		}
	}
	else {
		plaintext = "  "+plaintext;
		// 9.  FRE is xored with the first 8 octets of the given plaintext, now
	    //	   that we have finished encrypting the 10 octets of prefixed data.
	    // 	   This produces C11-C18, the next 8 octets of ciphertext.
		for (var i = 2; i < block_size; i++) ciphertext += String.fromCharCode(FRE[i] ^ plaintext.charCodeAt(i));

		for(n=block_size; n<plaintext.length; n+=block_size) {
			// 10. FR is loaded with C11-C18
			for (var i = 0; i < block_size; i++) FR[i] = ciphertext.charCodeAt(n+i);
			
			// 11. FR is encrypted to produce FRE.
			FRE = blockcipherencryptfn(FR, key);
			
			// 12. FRE is xored with the next 8 octets of plaintext, to produce the
			//     next 8 octets of ciphertext.  These are loaded into FR and the
			//     process is repeated until the plaintext is used up.
			for (var i = 0; i < block_size; i++) ciphertext += String.fromCharCode(FRE[i] ^ plaintext.charCodeAt(n+i));
		}
		
	}
	return ciphertext;
}


/**
 * decrypts the prefixed data for the Modification Detection Code (MDC) computation
 * @param blockcipherencryptfn cipher function to use
 * @param block_size blocksize of the algorithm
 * @param key the key for encryption
 * @param ciphertext the encrypted data
 * @return plaintext data of D(ciphertext) with blocksize length +2
 */
function openpgp_cfb_mdc(blockcipherencryptfn, block_size, key, ciphertext) {
	var iblock = new Array(block_size);
	var ablock = new Array(block_size);
	var i;

	// initialisation vector
	for(i=0; i < block_size; i++) iblock[i] = 0;

	iblock = blockcipherencryptfn(iblock, key);
	for(i = 0; i < block_size; i++)
	{
		ablock[i] = ciphertext.charCodeAt(i);
		iblock[i] ^= ablock[i];
	}

	ablock = blockcipherencryptfn(ablock, key);

	return misc.bin2str(iblock)+
		String.fromCharCode(ablock[0]^ciphertext.charCodeAt(block_size))+
		String.fromCharCode(ablock[1]^ciphertext.charCodeAt(block_size+1));
}
/**
 * This function decrypts a given plaintext using the specified
 * blockcipher to decrypt a message
 * @param blockcipherfn the algorithm _encrypt_ function to encrypt
 *  data in one block_size encryption. The function must be 
 *  specified as blockcipherfn([integer_array(integers 0..255)] 
 *  block,[integer_array(integers 0..255)] key) returning an 
 *  array of bytes (integers 0..255)
 * @param block_size the block size in bytes of the algorithm used
 * @param plaintext ciphertext to be decrypted provided as a string
 * @param key key to be used to decrypt the ciphertext as 
 *  integer_array(integers 0..255)]. This will be passed to the 
 *  blockcipherfn
 * @param resync a boolean value specifying if a resync of the 
 *  IV should be used or not. The encrypteddatapacket uses the 
 *  "old" style with a resync. Decryption within an 
 *  encryptedintegrityprotecteddata packet is not resyncing the IV.
 * @return a string with the plaintext data
 */

function openpgp_cfb_decrypt(blockcipherencryptfn, block_size, key, ciphertext, resync)
{
	logger.debug("resync:"+resync);
	var iblock = new Array(block_size);
	var ablock = new Array(block_size);
	var i, n, text = '';

	// initialisation vector
	for(i=0; i < block_size; i++) iblock[i] = 0;

	iblock = blockcipherencryptfn(iblock, key);
	for(i = 0; i < block_size; i++)
	{
		ablock[i] = ciphertext.charCodeAt(i);
		iblock[i] ^= ablock[i];
	}

	ablock = blockcipherencryptfn(ablock, key);

//	logger.debug("openpgp_cfb_decrypt:\niblock:"+misc.hexidump(iblock)+"\nablock:"+misc.hexidump(ablock)+"\n");
//	logger.debug((ablock[0]^ciphertext.charCodeAt(block_size)).toString(16)+(ablock[1]^ciphertext.charCodeAt(block_size+1)).toString(16));
	
	// test check octets
	if(iblock[block_size-2]!=(ablock[0]^ciphertext.charCodeAt(block_size))
	|| iblock[block_size-1]!=(ablock[1]^ciphertext.charCodeAt(block_size+1)))
	{
		throw new Error("error duding decryption. Symmectric encrypted data not valid.");
		return text;
	}
	
	/*  RFC4880: Tag 18 and Resync:
	 *  [...] Unlike the Symmetrically Encrypted Data Packet, no
   	 *  special CFB resynchronization is done after encrypting this prefix
     *  data.  See "OpenPGP CFB Mode" below for more details.

	 */
	
	if (resync) {
	    for(i=0; i<block_size; i++) iblock[i] = ciphertext.charCodeAt(i+2);
		for(n=block_size+2; n<ciphertext.length; n+=block_size)
		{
			ablock = blockcipherencryptfn(iblock, key);

			for(i = 0; i<block_size && i+n < ciphertext.length; i++)
			{
				iblock[i] = ciphertext.charCodeAt(n+i);
				text += String.fromCharCode(ablock[i]^iblock[i]); 
			}
		}
	} else {
		for(i=0; i<block_size; i++) iblock[i] = ciphertext.charCodeAt(i);
		for(n=block_size; n<ciphertext.length; n+=block_size)
		{
			ablock = blockcipherencryptfn(iblock, key);
			for(i = 0; i<block_size && i+n < ciphertext.length; i++)
			{
				iblock[i] = ciphertext.charCodeAt(n+i);
				text += String.fromCharCode(ablock[i]^iblock[i]); 
			}
		}
		
	}
	
	return text;
}


function normal_cfb_encrypt(blockcipherencryptfn, block_size, key, plaintext, iv) {
  try {
	  var blocki ="";
	  var blockc = "";
	  var pos = 0;
	  var cyphertext = "";
	  blocki = iv.substring(0,block_size);
	  //for (var i = 0; i < block_size; i++) blocki += String.fromCharCode(0);
	  while (plaintext.length > block_size*pos) {
	  	var encblock = blockcipherencryptfn(blocki, key);
	    blockp = plaintext.substring((pos*block_size),(pos*block_size)+block_size);
      var c="";
	  	for (var i=0; i < blockp.length; i++)
	  		c += String.fromCharCode(blockp.charCodeAt(i) ^ encblock[i]);

      cyphertext += c;
      blocki = c;
	  	pos++;
	  }
  } catch (err) {
    logger.error(err);
  }
	return cyphertext;
}

function normal_cfb_decrypt(blockcipherencryptfn, block_size, key, ciphertext, iv) {
	var blockp ="";
	var pos = 0;
	var plaintext = "";
	var offset = 0;
	if (iv == null)
		for (var i = 0; i < block_size; i++) blockp += String.fromCharCode(0);
	else
		blockp = iv.substring(0,block_size);
	while (ciphertext.length > (block_size*pos)) {
		var decblock = blockcipherencryptfn(blockp, key);
		blockp = ciphertext.substring((pos*(block_size))+offset,(pos*(block_size))+(block_size)+offset);
		for (var i=0; i < blockp.length; i++) {
			plaintext += String.fromCharCode(blockp.charCodeAt(i) ^ decblock[i]);
		}
		pos++;
	}
	
	return plaintext;
}

exports.openpgp_cfb_decrypt = openpgp_cfb_decrypt;
exports.openpgp_cfb_encrypt = openpgp_cfb_encrypt;
exports.normal_cfb_decrypt = normal_cfb_decrypt;
exports.normal_cfb_encrypt = normal_cfb_encrypt;
