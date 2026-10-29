const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { models: { Faq } } = require('./models');

const createFaq = async (reqBody) => {
    const faq = await Faq.create({ question: reqBody.question, answer: reqBody.answer });
    if (!faq) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new FAQ');
    }
    return faq;
};

const getAllFaq = async () => Faq.findAll({
    attributes: ['id', 'question', 'answer'],
    where: { is_active: true },
});

const updateFaq = async (reqBody, id) => {
    // Looked up first: a bulk update's affected count is 0 when nothing changed, which is not "not found".
    const faq = await Faq.findByPk(id);
    if (!faq) {
        throw new ApiError(httpStatus.NOT_FOUND, 'FAQ not found');
    }
    const { question, answer } = reqBody;
    if (question && typeof question === 'string') faq.question = question;
    if (answer && typeof answer === 'string') faq.answer = answer;
    await faq.save();
    return faq;
};

const deleteFaq = async (id) => {
    const faq = await Faq.findOne({ where: { id, is_active: true } });
    if (!faq) {
        throw new ApiError(httpStatus.NOT_FOUND, 'FAQ not found');
    }
    await faq.destroy();
};

module.exports = {
    createFaq,
    getAllFaq,
    updateFaq,
    deleteFaq,
};
