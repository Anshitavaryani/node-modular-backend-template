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
    const { question, answer } = reqBody;
    const changes = {};
    if (question && typeof question === 'string') changes.question = question;
    if (answer && typeof answer === 'string') changes.answer = answer;

    // A bulk update returns the affected row count; 0 means no FAQ has this id.
    const [affectedCount] = await Faq.update(changes, { where: { id } });
    if (affectedCount === 0) {
        throw new ApiError(httpStatus.NOT_FOUND, 'FAQ not found');
    }
    return Faq.findByPk(id);
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
