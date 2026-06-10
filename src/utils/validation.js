const mongoose = require('mongoose');
const AppError = require('./AppError');

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInteger = (value, field, options = {}) => {
  const { defaultValue, max } = options;

  if ((value === undefined || value === '') && defaultValue !== undefined) {
    return defaultValue;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new AppError(`${field} harus berupa angka bulat positif`, 400);
  }

  return max ? Math.min(number, max) : number;
};

const parseNonNegativeNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`${field} harus berupa angka dan tidak boleh negatif`, 400);
  }
  return number;
};

const assertObjectId = (value, field = 'id') => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${field} tidak valid`, 400);
  }
};

const parseDate = (value, field) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new AppError(`${field} harus berupa tanggal yang valid`, 400);
  }
  return date;
};

const pickFields = (source, allowedFields) => {
  const result = {};
  for (const field of allowedFields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
};

module.exports = {
  assertObjectId,
  escapeRegex,
  parseNonNegativeNumber,
  parsePositiveInteger,
  parseDate,
  pickFields,
};
